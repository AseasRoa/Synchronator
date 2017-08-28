//=======================================================================================//
//== This example benchmarks the speed of calling functions with the native Async-Await ==/
//=======================================================================================//



// Few functions used for the benchmark

var testFunc = function()
{
	return new Promise(function (resolve, reject) {
		resolve("Async-Await Benchmark")
	})
}

async function fn1()
{
	// wait for the asynchronous function 3 times
	var result = await testFunc()
	var result = await testFunc()
	var result = await testFunc()

	return result
}

async function fn2()
{
	// run another "async" function million times
	var result

	for (var i = 0; i < 1000000; i++)
	{
		result = await fn1()
	}

	return result
}

// Start benchmarking

console.time("Speed")

fn2().then(function(result)
{
	console.log(result)
	console.timeEnd("Speed")
})