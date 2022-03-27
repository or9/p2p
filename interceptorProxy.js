const https = require("https");
const { session } = require("electron");

const filter = {
	urls: [
		"https://*/*"
	],
};

module.exports = {
	get filter() { return filter },
	init,
};

function init() {
	console.log("doing session stuff");
	// can chain off each method?
	// if not, use methods array
	session
		.defaultSession
		.webRequest
		.onBeforeSendHeaders(filter, proxyRequestHandler);
	console.log("done session stuff");

	// [
	// 	"onBeforeRequest",
	// 	"onBeforeSendHeaders",
	// 	"onSendHeaders",
	// 	"onHeadersReceived",
	// 	"onResponseStarted",
	// 	"onBeforeRedirect",
	// 	"onCompleted",
	// 	"onErrorOccurred",
	// ]
	// .forEach((method) => {
	// 	session
	// 		.defaultSession
	// 		.webRequest[method](filter, proxyRequestHandler);
	// });
}

function proxyRequestHandler(details, callback) {
	console.log("#proxyRequestHandler details", details);
	https.request(getRequestOptions(details), handleResponse);
}

function handleResponse(res) {
	const data = ``;

	res.on("data", (d) => {
		data += d;
	});

	res.on("end", () => {
		callback(data);
	});

	res.end();
}

function getRequestOptions(requestDetails = {}) {
	return {
		protocol: "https",
		port: 443,
		...requestDetails,
	};
}
