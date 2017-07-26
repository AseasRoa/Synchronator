# Synchronator - PHP-like synchronous code in NodeJS

# A little bit of history

I made this module for my custom NodeJS framework and it helps me a lot!

When I decided to rewrite my project from PHP to NodeJS, I thought that converting some functions from synchronous to asynchronous would not be such a big deal, but I quickly realized that this is not the case. My PHP code was already ugly and I did not want to make it worse, so I decided to find a solution. I knew there were many ways to make JavaScript code to look more synchronous - Promise, Generators and all kind of modules - but neither of them makes the code 100% synchronous. I wanted 100% synchronous code, so I wrote this tool for me.

# The problem in NodeJS

Writing asynchronous code in NodeJS creates a mess. But in NodeJS we don't have the same kind of events like in JavaScript (in browsers). We don't use out mouse or keyboard to interact with NodeJS. We use asynchronous functions in NodeJS mostly to prevent it from blocking. We don't want to block the whole application while reading a file for example, but in PHP we are used to read a file in one row of code without having blocking issues. PHP is of course much more intuitive, but can we do the same in NodeJS?

Yes, we can write fully synchronous code in NodeJS and still using asynchronous functions! And we don't need Promise or anything else that adds extra code. We can do that by translating out synchronous code into asynchronous in background.
