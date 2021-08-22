package logic

import (
	"fmt"
	"hash/crc32"
	"sync/atomic"
	"time"
)

var idCounter uint32 = (uint32)(time.Now().Unix())

func GetShortId() string {
	val := atomic.AddUint32(&idCounter, 1)
	buf := [4]byte{
		(byte)(val & 0xff),
		(byte)((val >> 8) & 0xff),
		(byte)((val >> 16) & 0xff),
		(byte)((val >> 24) & 0xff),
	}
	val = crc32.ChecksumIEEE(buf[:])
	return makeShortIdString(val)
}

func makeShortIdString(val uint32) string {
	// x00xx0x
	var res [7]byte
	x := val
	res[6] = numToChar(byte(x % 52))
	x /= 52
	res[5] = byte(x%10) + '0'
	x /= 10
	res[4] = numToChar(byte(x % 52))
	x /= 52
	res[3] = numToChar(byte(x % 52))
	x /= 52
	res[2] = byte(x%10) + '0'
	x /= 10
	res[1] = byte(x%10) + '0'
	x /= 10
	res[0] = numToChar(byte(x % 52))
	return string(res[:])
}

func numToChar(num byte) byte {
	if num < 26 {
		return num + 'a'
	}
	if num < 52 {
		return num - 26 + 'A'
	}
	panic(fmt.Sprintf("value must be below 52; got %v", num))
}
