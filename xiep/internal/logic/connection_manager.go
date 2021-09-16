package logic

import (
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"
	"xiep/internal/common"
)

const (
	cmDispatcherLoopMsec = 5 // Period of queue polling in dispatcher loop
)

// Orchestrator functionality related to edit sessions and processing changes over sockets.
// Interface allows us to decouple connectionManager from orchestrator
type editSessionHandler interface {
	startSession(sessionKey string) (startMsg string)
	isSessionOpen(sessionKey string) bool
	changeReceived(sessionKey string, clientRevisionId int, selStr, changeStr string) bool
	sessionClosed(sessionKey string)
}

type connectedPeer struct {
	// Client's IP address
	clientIP string
	// Peer's session key, as soon as we've received and verified it
	sessionKey string
	// Timestamp of last activity, so we can get rid of idle peers
	lastActiveUtc time.Time
	// Socket handler reads strings from this, and sends them to peer as messages
	send chan string
	// Socket handler reads this, and if a string comes through, it closes the socket with that message
	closeConn chan string
}

type connectionManager struct {
	xlog               common.XieLogger
	wgShutdown         *sync.WaitGroup
	exiting            int32
	editSessionHandler editSessionHandler
	mu                 sync.Mutex // For connected peers
	peers              []*connectedPeer
	qmu                sync.Mutex // For message queue
	queue              []interface{}
}

func (cm *connectionManager) init(xlog common.XieLogger,
	wgShutdown *sync.WaitGroup,
	editSessionHandler editSessionHandler) {
	cm.xlog = xlog
	cm.wgShutdown = wgShutdown
	cm.editSessionHandler = editSessionHandler
	go cm.dispatch()
}

func (cm *connectionManager) shutdown() {
	atomic.AddInt32(&cm.exiting, 1)
}

// Registers a new socket connection when it comes in.
func (cm *connectionManager) NewConnection(clientIP string) (
	receive func(msg *string),
	send <-chan string,
	closeConn chan string,
) {
	cm.mu.Lock()
	defer cm.mu.Unlock()

	// Keep track of peer; create channels for interaction for socket handler
	peer := connectedPeer{
		clientIP:      clientIP,
		lastActiveUtc: time.Now().UTC(),
		send:          make(chan string),
		closeConn:     make(chan string),
	}
	cm.peers = append(cm.peers, &peer)
	send = peer.send
	closeConn = peer.closeConn
	receive = func(msg *string) {
		if msg == nil {
			cm.peerGone(&peer)
		} else {
			cm.messageFromPeer(&peer, *msg)
		}
	}
	return
}

func (cm *connectionManager) peerGone(peer *connectedPeer) {
	cm.mu.Lock()
	defer cm.mu.Unlock()

	// Remove peer from out list
	i := 0
	for _, p := range cm.peers {
		if p != peer {
			cm.peers[i] = p
			i++
		}
	}
	cm.peers = cm.peers[:i]

	// Tell orchestrator that session is over
	cm.editSessionHandler.sessionClosed(peer.sessionKey)
}

func (cm *connectionManager) messageFromPeer(peer *connectedPeer, msg string) {
	cm.mu.Lock()
	defer cm.mu.Unlock()

	// Is this peer still on our list?
	peerIx := -1
	for ix, p := range cm.peers {
		if p == peer {
			peerIx = ix
			break
		}
	}
	if peerIx == -1 {
		// Not on our list? Weird. Let's close it.
		peer.closeConn <- "This peer is no longer on our list"
		return
	}
	peer.lastActiveUtc = time.Now().UTC()
	// Diagnostic: see what happens when message handling code panics
	if msg == "BOO" {
		panic("Panicking because of a diagnostic BOO")
	}
	// Client announcing their session key as the first message
	if strings.HasPrefix(msg, "SESSIONKEY ") {
		if peer.sessionKey != "" {
			peer.closeConn <- "Protocol violation: this client already sent its session key"
			return
		}
		sessionKey := msg[11:]
		startMsg := cm.editSessionHandler.startSession(sessionKey)
		if startMsg == "" {
			peer.closeConn <- "We are not expecting a session with this key."
			return
		}
		peer.sessionKey = sessionKey
		peer.send <- "HELLO " + startMsg
		return
	}
	// Anything else: client must be past sessionkey check
	if peer.sessionKey == "" {
		peer.closeConn <- "Don't talk until you've announced your session key"
		return
	}
	// Just a keepalive ping: see if session is still open?
	if msg == "PING" {
		if !cm.editSessionHandler.isSessionOpen(peer.sessionKey) {
			peer.closeConn <- "This is not an open session"
		}
		return
	}
	// Client announced a change
	if strings.HasPrefix(msg, "CHANGE ") {
		ix1 := strings.Index(msg[7:], " ")
		if ix1 != -1 {
			ix1 += 7
		}
		ix2 := strings.Index(msg[ix1+1:], " ")
		if ix2 != -1 {
			ix2 += ix1 + 1
		} else {
			ix2 = len(msg)
		}
		revId, err := strconv.Atoi(msg[7:ix1])
		if err != nil {
			peer.closeConn <- "Invalid message: failed to parse revision ID"
			return
		}
		selStr := msg[ix1+1 : ix2]
		changeStr := ""
		if ix2 != len(msg) {
			changeStr = msg[ix2+1:]
		}
		if !cm.editSessionHandler.changeReceived(peer.sessionKey, revId, selStr, changeStr) {
			peer.closeConn <- "We don't like this change; your session might have expired, the doc may be gone, or the change may be invalid"
		}
		return
	}
	// Anything else: No.
	peer.closeConn <- "You shouldn't have said that"
}

func (cm *connectionManager) broadcast(ctb *changeToBroadcast) {
	cm.qmu.Lock()
	defer cm.qmu.Unlock()
	cm.queue = append(cm.queue, ctb)
}

func (cm *connectionManager) terminateSessions(sessionKeys map[string]bool) {
	cm.qmu.Lock()
	defer cm.qmu.Unlock()
	cm.queue = append(cm.queue, sessionKeys)
}

// Running in separate goroutine, processes FIFO message queue.
func (cm *connectionManager) dispatch() {
	ticker := time.NewTicker(cmDispatcherLoopMsec * time.Millisecond)
	batch := make([]interface{}, 0)
	for {
		<-ticker.C
		// Shutting down? Stop delivering and just leave
		if atomic.LoadInt32(&cm.exiting) != 0 {
			ticker.Stop()
			break
		}
		// Copy entire queue, deliver everything in one fell swoop
		// Hold lock only for this copy
		func() {
			cm.qmu.Lock()
			defer cm.qmu.Unlock()
			for _, x := range cm.queue {
				batch = append(batch, x)
			}
			cm.queue = cm.queue[:0]
		}()
		// Perform each item
		for _, itm := range batch {
			switch v := itm.(type) {
			case *changeToBroadcast:
				cm.doBroadcast(v)
			case map[string]bool:
				cm.doTerminateSessions(v)
			default:
				panic("Unexpected type in message queue")
			}
		}
		// Clear batch slice
		batch = batch[:0]
	}
	cm.wgShutdown.Done()
}

// Broadcasts message to the peers that need to hear it.
// Thread-safe; invoked from dispatch goroutine.
func (cm *connectionManager) doBroadcast(ctb *changeToBroadcast) {

	// Gather peers to update, and to ack
	// Only hold lock while gathering; subsequent sending no longer needs it
	peersToUpdate := make([]*connectedPeer, 0)
	var peerToAck *connectedPeer
	func() {
		cm.mu.Lock()
		defer cm.mu.Unlock()
		for _, peer := range cm.peers {
			// Propagate to all provided session keys, except sender herself
			if _, ok := ctb.receiverSessionKeys[peer.sessionKey]; ok {
				if peer.sessionKey != ctb.sourceSessionKey {
					peersToUpdate = append(peersToUpdate, peer)
				}
			}
			// Acknowledge change to sender: but only for actual content changes!
			// We're not acknowledging selection changes, as those don't change revision ID
			if peer.sessionKey == ctb.sourceSessionKey && ctb.changeJson != "" {
				peerToAck = peer
			}
		}
	}()

	// Build messages
	updMsg := "UPDATE " + strconv.Itoa(ctb.newDocRevisionId) + " " + ctb.sourceSessionKey + " " + ctb.selJson
	if ctb.changeJson != "" {
		updMsg += " " + ctb.changeJson
	}
	ackMsg := "ACKCHANGE " + strconv.Itoa(ctb.sourceBaseDocRevisionId) + " " + strconv.Itoa(ctb.newDocRevisionId)

	// Summon the pidgeons
	for _, peer := range peersToUpdate {
		peer.send <- updMsg
	}
	if peerToAck != nil {
		peerToAck.send <- ackMsg
	}
}

// Terminates sessions identified by the provided keys.
// Thread-safe; invoked from dispatch goroutine.
func (cm *connectionManager) doTerminateSessions(sessionKeys map[string]bool) {

	// Gather peers to close
	// We only send signal to terminate, but don't remove from list of peers
	// Socket handler will notify us of connection's closure via peerGone
	// Only hold lock while gathering; subsequent sending no longer needs it
	peersToClose := make([]*connectedPeer, 0)
	func() {
		cm.mu.Lock()
		defer cm.mu.Unlock()
		for _, peer := range cm.peers {
			if _, ok := sessionKeys[peer.sessionKey]; ok {
				peersToClose = append(peersToClose, peer)
			}
		}
	}()
	// Actually close
	for _, peer := range peersToClose {
		peer.closeConn <- "Terminating because session has been idle for too long"
	}
}
