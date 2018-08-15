/*
	This module shows us:
	- that we can run one function marked with * from another function marked with *
	- that in a function marked with * we can run various asynchronous function
 */

var functions = require("./functions")

var sleep = function * (time)
{
	// we have 3 sleep functions, let's divide the time
	time = time / 3

	// get the start time (in ms) and run the sleep functions
	var startTime = new Date().getTime()

	functions.sleepC(time, (0)) // that (0) argument tells the system that the function is a callback function
	functions.sleepP(time)
	functions.sleepS(time)

	// find out how much time elapsed and return the value (in ms)
	var elapsedMilliseconds = new Date().getTime() - startTime

	return elapsedMilliseconds
}

function * start()
{
	var elapsedMilliseconds = sleep(1000)

	return "Sleeping for " + elapsedMilliseconds + " milliseconds"
}

module.exports = {
	start : start,
	sleep : sleep
}