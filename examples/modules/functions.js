// Let's have few asynchronous functions
var sleepC = function(time, callback) {
	setTimeout(() => {callback()}, time)
}

var sleepP = function(time) {
	return new Promise(function (resolve, reject) {
		setTimeout(() => {resolve()}, time)
	})
}

var sleepS = function(time) {
	return new Synchronator(function (resolve, reject) {
		setTimeout(() => {resolve()}, time)
	})
}

module.exports = {
	sleepC : sleepC,
	sleepP : sleepP,
	sleepS : sleepS
}