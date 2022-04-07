//#!/usr/bin/env node
//
// WebSocket chat server
// Implemented using Node.js
//
// Requires the websocket module.
//
// WebSocket and WebRTC based multi-user chat sample with two-way video
// calling, including use of TURN if applicable or necessary.
//
// This file contains the JavaScript code that implements the server-side
// functionality of the chat system, including user ID management, message
// reflection, and routing of private messages, including support for
// sending through unknown JSON objects to support custom apps and signaling
// for WebRTC.
//
// Requires Node.js and the websocket module (WebSocket-Node):
//
//  - http://nodejs.org/
//  - https://github.com/theturtle32/WebSocket-Node
//
// To read about how this sample works:  http://bit.ly/webrtc-from-chat
//
// Any copyright is dedicated to the Public Domain.
// http://creativecommons.org/publicdomain/zero/1.0/

import http from "http";
import https from "https";
import {readFileSync} from "fs";
import {
	dirname,
	join,
} from "path";
import websocketPkg from "websocket";
import log from "electron-log";

// Pathnames of the SSL key and certificate files to use for
// HTTPS connections.

const WebSocketServer = websocketPkg.server;

// Because modules don't have __dirname injected
const __dirname = dirname(new URL(import.meta.url).pathname);

log.transports.file.resolvePath = () => join(__dirname, `logs/chatserver.log`);

// const keyFilePath = `${__dirname}/private/local.key`;
// const certFilePath = `${__dirname}/certs/local.crt`;

// log.info(`keyFilePath: ${keyFilePath}`);
// log.info(`certFilePath: ${certFilePath}`);

// Used for managing the text chat user list.

var connectionArray = [];
var nextID = Date.now();
var appendToMakeUnique = 1;

// Output logging information to console

// function log(text) {
// 	var time = new Date();

// 	console.log("[" + time.toLocaleTimeString() + "] " + text);
// }

// Try to load the key and certificate files for SSL so we can
// do HTTPS (required for non-local WebRTC).

// const httpsOptions = {
// 	key: null,
// 	cert: null,
// };

// try {
// 	log.info(`trying to read key/cert from file sys`);
// 	httpsOptions.key = readFileSync(keyFilePath, `utf8`);
// 	log.info(`key: ${httpsOptions.key}`);
// 	try {
// 		httpsOptions.cert = readFileSync(certFilePath, `utf8`);
// 		log.info(`cert ${httpsOptions.cert}`);
// 	} catch(err) {
// 		log.error(`Error reading file ${err.toString()}; setting key/cert to null.`);
// 		httpsOptions.key = null;
// 		httpsOptions.cert = null;
// 	}
// } catch(err) {
// 	log.error(`Error reading file ${err.toString()}; setting key/cert to null.`);
// 	httpsOptions.key = null;
// 	httpsOptions.cert = null;
// }

// // If we were able to get the key and certificate files, try to
// // start up an HTTPS server.

// var webServer = null;

// try {
// 	if (httpsOptions.key && httpsOptions.cert) {
// 		log.info(`Key and cert provided. Creating HTTPS server`, httpsOptions);
// 		webServer = https.createServer(httpsOptions, handleWebRequest);
// 	}
// } catch(err) {
// 	log.info(`caught error creating https server`, err);
// 	try {
// 		log.info(`No key/cert found. Creating HTTP server.`);
// 		log.info(`navigator.getUserMedia will return null unless accessing via HTTPS or localhost`);
// 		webServer = http.createServer({}, handleWebRequest);
// 	} catch(err) {
// 		webServer = null;
// 		log.error(`Error attempting to create HTTP(s) server: ${err.toString()}`);
// 	}
// }

// if (!webServer) {
	// try {
	// 	log.info(`No key/cert found. Creating HTTP server.`);
	// 	log.info(`navigator.getUserMedia will return null unless accessing via HTTPS or localhost`);
	// 	webServer = http.createServer({}, handleWebRequest);
	// } catch(err) {
	// 	webServer = null;
	// 	log.error(`Error attempting to create HTTP(s) server: ${err.toString()}`);
	// }
// }


// Our server does nothing but service WebSocket
// connections, so every request just returns 404. Real Web
// requests are handled by the main server on the box. If you
// want to, you can return real HTML here and serve Web content.

// function handleWebRequest(request, response) {
// 	log.info(`Received request for ${request.url}`);

// 	response.writeHead(404);
// 	response.end();
// }

// Spin up the server on the port assigned to this sample.
// This will be turned into a WebSocket port very shortly.

// webServer.listen(6503, function() {
// 	log.info(`Server is listening on port 6503`);
// });

// Create the WebSocket server by converting the HTTPS server into one.

import {
	httpsServer,
} from "./server.mjs";

const wsServer = new WebSocketServer({
  // httpServer: webServer,
  httpServer: httpsServer,
  autoAcceptConnections: false
});

if (!wsServer) {
  log.error(`ERROR: Unable to create WbeSocket server!`);
}


// Set up a "connect" message handler on our WebSocket server. This is
// called whenever a user connects to the server's port using the
// WebSocket protocol.

wsServer.on(`request`, handleWsRequest);

function handleWsRequest(request) {
	if (!originIsAllowed(request.origin)) {
		request.reject();
		return void log.info(`Connection from ${request.origin} rejected.`);
	}

	// Accept the request and get a connection.

	var connection = request.accept(`json`, request.origin);

	// Add the new connection to our list of connections.

	log.info(`Connection accepted from ${connection.remoteAddress}.`);
	connectionArray.push(connection);

	connection.clientID = nextID;
	nextID++;

	// Send the new client its token; it send back a "username" message to
	// tell us what username they want to use.

	var msg = {
		type: "id",
		id: connection.clientID,
	};

	connection.sendUTF(JSON.stringify(msg));


	// Now send the updated user list. Again, please don't do this in a
	// real application. Your users won't like you very much.
	sendUserListToAll();

	// Set up a handler for the "message" event received over WebSocket. This
	// is a message sent by a client, and may be text to share with other
	// users, a private message (text or signaling) for one user, or a command
	// to the server.

	connection.on(`message`, handleConnectionMsg);

	// Handle the WebSocket "close" event; this means a user has logged off
	// or has been disconnected.
	connection.on(`close`, handleConnectionClose);


	// If you want to implement support for blocking specific origins, this is
	// where you do it. Just return false to refuse WebSocket connections given
	// the specified origin.
	function originIsAllowed(origin) {
		return true;    // We will accept all connections
	}

	// Scans the list of users and see if the specified name is unique. If it is,
	// return true. Otherwise, returns false. We want all users to have unique
	// names.
	function isUsernameUnique(name) {
		var isUnique = true;

		for (let i=0; i<connectionArray.length; i++) {
			if (connectionArray[i].username === name) {
				isUnique = false;
				break;
			}
		}

		return isUnique;
	}

	// Sends a message (which is already stringified JSON) to a single
	// user, given their username. We use this for the WebRTC signaling,
	// and we could use it for private text messaging.
	function sendToOneUser(target, msgString) {
		var isUnique = true;

		for (let i=0; i<connectionArray.length; i++) {
			if (connectionArray[i].username === target) {
				connectionArray[i].sendUTF(msgString);
				break;
			}
		}
	}

	// Scan the list of connections and return the one for the specified
	// clientID. Each login gets an ID that doesn't change during the session,
	// so it can be tracked across username changes.
	function getConnectionForID(id) {
		var connect = null;

		for (let i=0; i<connectionArray.length; i++) {
			if (connectionArray[i].clientID === id) {
				connect = connectionArray[i];
				break;
			}
		}

		return connect;
	}

	// Builds a message object of type "userlist" which contains the names of
	// all connected users. Used to ramp up newly logged-in users and,
	// inefficiently, to handle name change notifications.
	function makeUserListMessage() {
		var userListMsg = {
			type: "userlist",
			users: []
		};

		// Add the users to the list

		for (let i=0; i<connectionArray.length; i++) {
			userListMsg.users.push(connectionArray[i].username);
		}

		return userListMsg;
	}

	// Sends a "userlist" message to all chat members. This is a cheesy way
	// to ensure that every join/drop is reflected everywhere. It would be more
	// efficient to send simple join/drop messages to each user, but this is
	// good enough for this simple example.
	function sendUserListToAll() {
		const userListMsg = makeUserListMessage();
		const userListMsgStr = JSON.stringify(userListMsg);

		for (let i=0; i<connectionArray.length; i+=1) {
			connectionArray[i].sendUTF(userListMsgStr);
		}
	}

	function handleConnectionMsg(message) {
		if (message.type !== `utf8`) {
			return void log.warn(`Message type is not utf8. Not handling.`);
		}

		log.info("Received Message: " + message.utf8Data);

		// Process incoming data.

		let sendToClients = true;
		msg = JSON.parse(message.utf8Data);
		const connect = getConnectionForID(msg.id);

		// Take a look at the incoming object and act on it based
		// on its type. Unknown message types are passed through,
		// since they may be used to implement client-side features.
		// Messages with a "target" property are sent only to a user
		// by that name.

		switch(msg.type) {
			// Public, textual message
			case "message":
			msg.name = connect.username;
			msg.text = msg.text.replace(/(<([^>]+)>)/ig, "");
			break;

			// Username change
			case "username":
			let nameChanged = false;
			const origName = msg.name;

			// Ensure the name is unique by appending a number to it
			// if it's not; keep trying that until it works.
			while (!isUsernameUnique(msg.name)) {
				msg.name = origName + appendToMakeUnique;
				appendToMakeUnique++;
				nameChanged = true;
			}

			// If the name had to be changed, we send a "rejectusername"
			// message back to the user so they know their name has been
			// altered by the server.
			if (nameChanged) {
				const changeMsg = {
					id: msg.id,
					type: `rejectusername`,
					name: msg.name,
				};

				connect.sendUTF(JSON.stringify(changeMsg));
			}

			// Set this connection's final username and send out the
			// updated user list to all users. Yeah, we're sending a full
			// list instead of just updating. It's horribly inefficient
			// but this is a demo. Don't do this in a real app.
			connect.username = msg.name;
			sendUserListToAll();
			sendToClients = false;  // We already sent the proper responses
			break;
		}

		// Convert the revised message back to JSON and send it out
		// to the specified client or all clients, as appropriate. We
		// pass through any messages not specifically handled
		// in the select block above. This allows the clients to
		// exchange signaling and other control objects unimpeded.

		if (!sendToClients) {
			return void log.warn(`Send to clients is false. Don't send.`);
		}
		
		var msgString = JSON.stringify(msg);

		// If the message specifies a target username, only send the
		// message to them. Otherwise, send it to every user.
		if (msg.target?.length !== 0) {
		  sendToOneUser(msg.target, msgString);
		} else {
			for (let i=0; i<connectionArray.length; i++) {
				connectionArray[i].sendUTF(msgString);
			}
		}
	}

	function handleConnectionClose(reason, description = "") {
		// First, remove the connection from the list of connections.
		connectionArray = connectionArray.filter(el => el.connected);

		// Build and output log output for close information.

		if (description.length !== 0) {
			description= `: ${description}`;
		}

		const logMessage = `Connection closed: ${connection.remoteAddress} (${reason} ${description})`;
		
		return void log.info(logMessage);
	}
}

export default wsServer;
