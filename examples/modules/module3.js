/*
	This module shows us:
	- that we can mark class methods with *
 */

var module1 = require("module1")

var MyFunction = function * () {
	// if the constructor is marked with *, we need to return "this"
	return this
}

MyFunction.prototype.sleep = function * (time) {
	// let's borrow the sleep function from "module1"
	return module1.sleep(time)
}

MyFunction.prototype.start = function * () {
	var elapsedMilliseconds = this.sleep(1000)

	return "Sleeping for " + elapsedMilliseconds + " milliseconds"
}

module.exports = MyFunction