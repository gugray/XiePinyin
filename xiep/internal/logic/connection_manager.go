package logic

import (
	"time"
	"xiep/internal/common"
)

type connectedPeer struct {
	// Client's IP address
	clientIP string
	// Peer's session key, as soon as we've received and verified it
	sessionKey string
	// Timestamp of last activity, so we can get rid of idle peers
	lastActiveUtc time.Time
	// Socket handler writes received messages into this
	receive chan string
	// Socket handler reads strings from this, and sends them to peer as messages
	send chan string
	// Connection manager closes this to tell socket handler to close socket
	close chan string
}

type connectionManager struct {
	xlog              common.XieLogger
	documentJuggler   *documentJuggler
	broadcast         chan changeToBroadcast
	terminateSessions chan []string
	peers             []*connectedPeer
}

func (cm *connectionManager) init(xlog common.XieLogger, documentJuggler *documentJuggler) {
	cm.xlog = xlog
	cm.documentJuggler = documentJuggler
	cm.broadcast = make(chan changeToBroadcast)
	cm.terminateSessions = make(chan []string)
}

func (cm *connectionManager) getListenerChannels() (broadcast chan<- changeToBroadcast,
	terminateSessions chan<- []string) {
	return cm.broadcast, cm.terminateSessions
}

func (cm *connectionManager) NewConnection(clientIP string) (
	receive chan<- string,
	send <-chan string,
	close <-chan string,
) {
	// Keep track of peer; create channels for interaction for socket handler
	peer := connectedPeer{
		clientIP:      clientIP,
		lastActiveUtc: time.Now().UTC(),
		receive:       make(chan string),
		send:          make(chan string),
		close:         make(chan string),
	}
	cm.peers = append(cm.peers, &peer)
	receive = peer.receive
	send = peer.send
	close = peer.close
	// Spawn goroutine to listen
	go func() {
		for {
			msg, more := <-peer.receive
			if more {
				cm.messageFromPeer(&peer, msg)
			} else {
				cm.peerGone(&peer)
				break
			}
		}
	}()
	return
}

func (cm *connectionManager) peerGone(peer *connectedPeer) {

}

func (cm *connectionManager) messageFromPeer(peer *connectedPeer, msg string) {

}