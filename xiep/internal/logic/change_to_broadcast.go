package logic

type changeToBroadcast struct {
	sourceSessionKey string
	sourceBaseDocRevisionId int
	newDocRevisionId int
	receiverSessionKeys []string
	selJson string
	changeJson string
}
