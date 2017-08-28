// 1) == The main constructor ==========================================================================================

/**
 * The Synchronator construcor. It is similar to Promise, but is much faster.
 * Few other necessary functions are bundled with the constructor.
 * @param synchronatorFunction
 * @constructor
 */
const Synchronator = function(synchronatorFunction) {
	this.synchronatorFunction = synchronatorFunction
}

Synchronator.prototype.then = function(resolve, reject) {
	this.synchronatorFunction(resolve, reject)
}

// 2) == Functions to be added to the constructor ======================================================================

/**
 * Private function used to deal with inerator errors
 * @param iterator
 * @param error
 * @private
 */
Synchronator._callThrowFn = function(iterator, error)
{
	try
	{
		iterator.throw(error)
	}
	catch(e)
	{
		console.error(e.stack)
	}
}

/**
 * "thunkify" regular callback functions
 * @param fn
 * @returns {Function}
 */
Synchronator.thunkify = function(fn)
{
	this.a = 1
	return function(){
		var args = new Array(arguments.length);
		var ctx = this;

		for(var i = 0; i < args.length; ++i) {
			args[i] = arguments[i];
		}

		return function(done){
			var called;

			args.push(function(){
				if (called) return;
				called = true;
				done.apply(null, arguments);
			});

			try {
				fn.apply(ctx, args);
			} catch (err) {
				done(err);
			}
		}
	}
}

/**
 * Resolves Generator function that contains Synchronator/Promise/Thunk functions in it.
 * Each JavaScript function that would run in synchronous manner is wrapped with Synchronator.runGenerator()
 * @param generator
 * @returns {Function}
 */
Synchronator.runGenerator = function(generator)
{
	// timeout is used to prevent "Maximum call stack size exceeded"
	// http://stackoverflow.com/questions/20936486/node-js-maximum-call-stack-size-exceeded

	return function synchronatorResolveHelper()
	{
		//**
		//
		// This function wraps your original function and must be run with Synchronator.
		//
		//**

		var iterator = generator.apply(this, arguments)
		var iterations = 0

		return new Synchronator(function(resolve) {
			//var callNext  = next.bind(null, "next")
			//var callThrow = next.bind(null, "throw")
			var callThrow = Synchronator._callThrowFn.bind(null, iterator)

			function callNext(arg)
			{
				try
				{
					var result = iterator.next(arg)
					var value  = result.value

				} catch (e)
				{
					console.error(e.stack)
					return
				}

				iterations++

				if (result.done)
				{
					if (value instanceof Synchronator || value instanceof Promise)
					{
						if ("value" in value)
						{
							// the function returned syncronously
							callNext(value['value'])
						}
						else
						{
							resolve(value)
						}
					}
					else
					{
						// we need timeout, because the called function is syncronous
						// we need the resolve function to be created first
						if (typeof resolve === "function") resolve(value)
					}
				}
				else
				{
					if(iterations > 499)
					{
						iterations = 0

						if (value instanceof Synchronator || value instanceof Promise)
						{
							if ("value" in value)
							{
								// the function returned syncronously
								process.nextTick(function() {callNext(value['value'])})
							}
							else
							{
								process.nextTick(function() {value.then(callNext, callThrow)})
							}
						}
						else
						{
							process.nextTick(function() {callNext(value)})
						}
					}
					else {

						if (value instanceof Synchronator || value instanceof Promise)
						{
							if ("value" in value)
							{
								// the function returned syncronously
								callNext(value['value'])
							}
							else
							{
								value.then(callNext, callThrow)
							}
						}
						else
						{
							if (0)
							{
								// TODO make this to work with thunk functions
								if (typeof value === "function")
								{
									//log(value.toString())
									value(function(err, data) {callNext(data)})
									//value(callNext)

								}
								else
								{
									callNext(value)
								}
							}
							else
							{
								callNext(value)
							}
						}
					}
				}
			}

			callNext()
		})
	}
}

// 3) == Export ========================================================================================================
if (typeof module !== 'undefined')
{
	module.exports = Synchronator
}