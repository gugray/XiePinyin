package logic

type changeToBroadcast struct {
	sourceSessionKey string
	sourceBaseDocRevisionId int
	newDocRevisionId int
	receiverSessionKeys map[string]bool
	selJson string
	changeJson string
}
