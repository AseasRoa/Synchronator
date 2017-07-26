# Synchronator - PHP-like synchronous code in NodeJS

I made this module for my custom NodeJS framework and it helps me a lot!

# The problem
Writing asynchronous code in NodeJS creates a mess. But in NodeJS we don't have the same kind of events like in JavaScript (in browsers). We don't use out mouse or keyboard to interact with NodeJS. We use asynchronous functions in NodeJS mostly to prevent it from blocking. We don't want to block the whole application while reading a file for example, but in PHP we are used to read a file in one row of code without having blocking issues. PHP is of course much more intuitive, but can we do the same in NodeJS?

Yes, we can write fully synchronous code in NodeJS and still using asynchronous functions! And we don't need Promise or anything else that adds extra code. We can do that by translating out synchronous code into asynchronous in background.
