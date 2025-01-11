class ClassName
{
	constructor(argument)
	{
		this.property = argument
	}

	giveMeResultAfterTimeout(arg)
	{
		return new Promise((resolve) => {
			setTimeout(() => {
				resolve(arg)
			}, 1)
		})
	}

	method1()
	{
		return this.method2()
	}

	* method2()
	{
		return this["method-3"]()
	}

	* "method-3"()
	{
		return this.giveMeResultAfterTimeout(
			this.property
		)
	}
}

module.exports = ClassName