let giveMeResultAfterTimeout = function (arg) {
	return new Promise((resolve) => {
		setTimeout(() => {
			resolve(arg)
		}, 1)
	})
}

let giveMeResultAfterTimeoutWithSynchronator = function (arg) {
	return new Synchronator((resolve) => {
		setTimeout(() => {
			resolve(arg)
		}, 1)
	})
}

let giveMeResultAfterCallback = function(arg, callback)
{
	setTimeout(() => {
		callback(arg)
	})
}

let giveMeResultAfterCallback2 = function(arg1, arg2, callback)
{
	setTimeout(() => {
		callback(arg1, arg2)
	})
}

function * fn1()
{
	return giveMeResultAfterTimeout("res") + giveMeResultAfterTimeoutWithSynchronator("ult")
}

var fn2 = function * ()
{
	return giveMeResultAfterTimeout("res") + giveMeResultAfterTimeoutWithSynchronator("ult")
}

function * fn3()
{
	return giveMeResultAfterTimeout("res") + giveMeResultAfterTimeoutWithSynchronator("ult")
}

function * fn4()
{
	// If the callback function has only 1 argument, that argument is returned
	return giveMeResultAfterCallback("result", (0))
}

function * fn5()
{
	// If there are 2 or more arguments in the callback, an Object is returned
	let result = giveMeResultAfterCallback2("res", "ult", (0))

	return result[0] + result[1]
}

function * fn6()
{
	// If the callback function has 2 arguments and the first one equals to **null**, the second argument will be returned. The idea is that the first argument is an "error" argument and there is no error, so the second argument is the one that is important.
	return giveMeResultAfterCallback2(null, "result", (0))
}

module.exports = [fn1(), fn2(), fn3(), fn4(), fn5(), fn6()]