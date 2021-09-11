package logic

import (
	"strconv"
	"strings"
	"sync"
	"time"
	"xiep/internal/common"
)

// Document juggler functionality related to edit sessions and processing changes over sockets.
// Interface allows us to decouple connectionManager from documentJuggler
type editSessionHandler interface {
	startSession(sessionKey string) (startMsg string)
	isSessionOpen(sessionKey string) bool
	changeReceived(sessionKey string, clientRevisionId int, selStr, changeStr string) bool
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
	editSessionHandler editSessionHandler
	broadcast          chan changeToBroadcast
	terminateSessions  chan []string
	peers              []*connectedPeer
	mu                 sync.Mutex
}

func (cm *connectionManager) init(xlog common.XieLogger, editSessionHandler editSessionHandler) {
	cm.xlog = xlog
	cm.editSessionHandler = editSessionHandler
	cm.broadcast = make(chan changeToBroadcast)
	cm.terminateSessions = make(chan []string)
}

func (cm *connectionManager) getListenerChannels() (broadcast chan<- changeToBroadcast,
	terminateSessions chan<- []string) {
	return cm.broadcast, cm.terminateSessions
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
			peer.closeConn <- "We are not expecting a session with the key."
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
