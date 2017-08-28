var sleep = function(time) {
	return new Synchronator(function (resolve, reject) {
		setTimeout(() => {resolve(time + "ms timed out in module2.js")}, time)
	})
}

var fn1 = function*(time)
{
	var result = sleep(time)

	return result
}

function * fn2()
{
	var result = fn1(1000)

	return result
}

module.exports = {
	fn1: fn2,
	fn2: fn2
}