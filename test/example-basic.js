//===========================================================//
//== This example shows the low level usage of Synchronator ==/
//===========================================================//

var Synchronator = require("synchronator")

/**
 * Start with a function that returns either Promise or Synchronator object
 */
var sleep = function(time) {
	return new Synchronator(function (resolve, reject) {
		setTimeout(() => {resolve(time + "ms timed out")}, time)
	})
}

/**
 * "fn1" will be a special function (similar to "sleep") that can be run in another Generator controlled by Synchronator
 * (see "fn2" below)
 */
var fn1 = Synchronator.runGenerator(function*(time)
{
	var result = yield sleep(time)

	return result
})

/**
 * "fn2" is the same kind of function as "fn1" and we can run "fn1" in "fn2"
 */
var fn2 = Synchronator.runGenerator(function*()
{
	var result = yield fn1(1000)

	return result
})

/**
 * "fn2()" returns Synchronator object, so then we need to use "then" to get the result
 */
fn2().then(function (result) {
	console.log(result)
})