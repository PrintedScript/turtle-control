import { Server } from 'ws';
import { Turtle } from './turtle';
import World from './world';
import Queue from 'p-queue';

const wss = new Server({ port: 5757 });
const wss_frontend = new Server({ port: 5758 });

console.log('Started Turtle Control WS Server on port 5757 and port 5758');
//let app: App;
let turtles: { [id: number]: Turtle } = {};

const world = new World();
const queue = new Queue({ concurrency: 1 });
const turtleAddQueue = new Queue({ concurrency: 1 });
turtleAddQueue.pause();

async function SendFrontendData( type: string, data: any ) {
	wss_frontend.clients.forEach( client => {
		client.send( JSON.stringify( { type, data } ) );
	} );
}

(async () => {
	world.on('update', async (world) => {
		await SendFrontendData( 'world', world );
	});
	world.on('blockupdate', async (block) => {
		await SendFrontendData( 'blockupdate', block );
	})
	world.on('removeblock', async (block) => {
		await SendFrontendData( 'removeblock', block );
	})
	world.on('turtleupdate', async (turtle) => {
		await SendFrontendData( 'turtleupdate', turtle );
	})
	turtleAddQueue.start();

})();
// Turtle websocket

async function serializeTurtles() {
	return JSON.stringify(Object.values(turtles));
}

wss.on('connection', async function connection(ws,r) {
	console.log('New turtle connection established from ' + r.socket.remoteAddress)
	await turtleAddQueue.add(async () => {
		let turtle = new Turtle(ws, world);
		turtle.on('init', async () => {
			turtles[turtle.id] = turtle;
			turtle.on('update', async () => SendFrontendData( 'turtles', await serializeTurtles() ) );
			await SendFrontendData( 'turtles', await serializeTurtles() );
			await SendFrontendData( 'world', world.getAllBlocks() );
			ws.on('close', async () => {
				delete turtles[turtle.id];
				await SendFrontendData( 'turtles', await serializeTurtles() );
			});
		});
	});
});

// Frontend Connection

wss_frontend.on('connection', async function connection(ws, r) {
	console.log('New frontend connection established from ' + r.socket.remoteAddress)
	ws.send( JSON.stringify( { type: 'turtles', data: await serializeTurtles() } ) );
	ws.send( JSON.stringify( { type: 'world', data: world.getAllBlocks() } ) );
	ws.on('message', async ( data ) => {
		try {
			var MessageData = JSON.parse( data.toString() );
			switch( MessageData.type ) {
				case 'refresh':
					SendFrontendData( 'turtles', await serializeTurtles() );
					SendFrontendData( 'world', world.getAllBlocks() );
					break;
				case 'exec':
					var ExecType = MessageData.ExecType;
					var ExecData = MessageData.ExecData;
					var ExecResponse = await queue.add(() => (
						(turtles[MessageData.turtleindex] as any)[ExecType])(...ExecData)
					);
					ws.send( JSON.stringify( { type: 'exec_response', data: ExecResponse, nonce: MessageData.nonce } ) );
			}
		} catch( e ) {
			console.log(`Error while processing frontend message: ${e}`);
		}
	});
});

