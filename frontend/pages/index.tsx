// import Link from 'next/link';
import React, { createContext, Dispatch, SetStateAction, useEffect, useState } from 'react';
import TurtlePage from '../components/Turtle';
import { EventEmitter } from 'events';
import WorldRenderer from '../components/World';
import { makeStyles, Typography } from '@material-ui/core';

const useStyles = makeStyles(() => ({
	root: {
		width: '100vw',
		height: '100vh',
		display: 'flex',
		flexDirection: 'column',
		justifyContent: 'center',
		alignItems: 'center',
	},
	world: {
		width: '100%',
		height: 'calc(100% - 100px)'
	},
	message: {
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		background: '#f52a37',
		height: 50,
		width: '100%',
		padding: 5,
	},
}));

interface MyWindow extends Window {
	selectSlot: (id: number, slot: number) => Promise<any>;
	drop: (index: number, dir: BlockDirection) => Promise<any>;
	suck: (index: number, dir: BlockDirection) => Promise<any>;
	dig: (index: number, dir: BlockDirection) => Promise<any>;
	place: (id: number, dir: BlockDirection, signText?: string | undefined) => Promise<any>;
	refuel: (id: number, count?: number | undefined) => Promise<any>;
	undergoMitosis: (id: number) => Promise<any>;
	refresh: (id: number) => Promise<any>;
	craft: (id: number, amount: string) => Promise<any>;
	mineTunnel: (id: number, direction: string, length: number) => Promise<any>;
	move: (id: number, direction:string) => Promise<any>;
	turtle_websocket: WebSocket;
	exec: (index: number, action: string, ...args: any[]) => Promise<any>;
	refreshData(id: number): void;
	setWorld: Function;
	setTurtles: Function;
}

declare var window: MyWindow;

export enum BlockDirection { FORWARD, UP, DOWN }
export enum Direction { NORTH, EAST, SOUTH, WEST }
export enum Side { LEFT, RIGHT }

interface Slot {
	count: number;
	name: string;
	damage: number;
}

export class Turtle extends EventEmitter {
	inventory: Slot[];
	selectedSlot: number;
	x: number;
	y: number;
	z: number;
	d: Direction;
	label: string;
	fuel: number;
	maxFuel: number;
	id: number;

	constructor(json: any) {
		super();
		this.inventory = json.inventory;
		this.selectedSlot = json.selectedSlot;
		this.x = json.x;
		this.y = json.y;
		this.z = json.z;
		this.d = json.d;
		this.fuel = json.fuel;
		this.maxFuel = json.maxFuel;
		this.label = json.label;
		this.id = json.id;
	}

	async forward() {
		return window.exec(this.id, 'forward');
	}
	async back() {
		return window.exec(this.id, 'back');
	}
	async up() {
		return window.exec(this.id, 'up');
	}
	async down() {
		return window.exec(this.id, 'down');
	}
	async turnLeft(): Promise<boolean> {
		return window.exec(this.id, 'turnLeft');
	}
	async turnRight(): Promise<boolean> {
		return window.exec(this.id, 'turnRight');
	}
	async dig(dir: BlockDirection) {
		return window.exec(this.id, 'dig', dir);
	}
	async selectSlot(slot: number) {
		return window.exec(this.id, 'selectSlot', slot);
	}
	async place(dir: BlockDirection, signText?: string) {
		return window.exec(this.id, 'place', dir, signText);
	}
	async drop(dir: BlockDirection) {
		return window.exec(this.id, 'dropItem', dir);
	}
	async suck(dir: BlockDirection) {
		return window.exec(this.id, 'suckItem', dir);
	}
	async refuel(count?: number) {
		return window.exec(this.id, 'refuel', count);
	}
	async refresh() {
		return window.exec(this.id, 'refresh');
	}
	async undergoMitosis() {
		return window.exec(this.id, 'undergoMitosis');
	}
	async moveItems(slot: number, amount: string) {
		return window.exec(this.id, 'moveItems', slot, amount);
	}
	async craft(amount: string) {
		return window.exec(this.id, 'craft', amount);
	}
	async exec(command: string) {
		return window.exec(this.id, 'exec', command);
	}
	async equip(side: 'left' | 'right') {
		return window.exec(this.id, 'equip', side);
	}
	async mineTunnel(direction: string, length: number) {
		return window.exec(this.id, 'mineTunnel', direction, length);
	}
}

export interface World {
	[block: string]: any;
}
export const TurtleContext = createContext<[number, Dispatch<SetStateAction<number>>, Turtle[]]>([-1, () => { }, []] as any);

const IndexPage = () => {
	const classes = useStyles();

	const [turtles, setTurtles] = useState<Turtle[]>([]);
	const [world, setWorld] = useState<World>({});
	const [turtleId, setTurtleId] = useState<number>(-1);

	const worldRef = React.useRef<World>(world);
	const turtlesRef = React.useRef<Turtle[]>(turtles);

	useEffect(() => { worldRef.current = world; }, [world]);
	useEffect(() => { turtlesRef.current = turtles; }, [turtles]);
	useEffect( () => {
		window.setTurtles = (array: any[]) => {
			setTurtles(array.map(turtle => new Turtle(turtle)));
		};
		window.setWorld = (world: World) => {
			setWorld(world);
			//trigger a re-render
			window.setTurtles(turtlesRef.current);
		};

		window.turtle_websocket = new WebSocket('ws://localhost:5758');
		window.turtle_websocket.addEventListener("message", async (event) => {
			const data = JSON.parse(event.data);
			if (data.type === 'world') {
				window.setWorld(data.data);
			} else if (data.type === 'turtles') {
				window.setTurtles(JSON.parse(data.data));
			} else if (data.type === 'blockupdate') {
				const block = data.data;
				worldRef.current[block.x + ',' + block.y + ',' + block.z] = block.block;
				window.setWorld(worldRef.current);
			} else if (data.type === 'removeblock') {
				const block = data.data;
				delete worldRef.current[block.x + ',' + block.y + ',' + block.z];
				window.setWorld(worldRef.current);
			} else if (data.type === 'turtleupdate') {
				// { id: turtle.id, x, y, z, d }
				const turtle_position = data.data;
				// update the turtle position
				const turtle = turtlesRef.current.find(t => t.id === turtle_position.id);
				if (turtle) {
					turtle.x = turtle_position.x;
					turtle.y = turtle_position.y;
					turtle.z = turtle_position.z;
					turtle.d = turtle_position.d;
					turtle.fuel = turtle_position.fuel;
					turtle.inventory = turtle_position.inventory;
					window.setTurtles(turtlesRef.current);
				}
			}
		})

		window.exec = async (index : number, action: string, ...args: any[]) => {
			var nonce = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
			window.turtle_websocket.send(JSON.stringify({
				type: 'exec',
				turtleindex: index,
				ExecType: action,
				ExecData: args,
				nonce: nonce
			}));

			return new Promise((resolve) => {
				window.turtle_websocket.addEventListener("message", async (event) => {
					const data = JSON.parse(event.data);
					if (data.nonce === nonce) {
						resolve(data);
					}
				})
			});
		}

	}, [setTurtles, setWorld]);

	const selectedTurtle = turtles.find((t: { id: any; }) => t.id === turtleId);
	useEffect(() => {
		if (turtles.length === 1 || turtles.length > 0 && (turtleId === -1 || !selectedTurtle))
			setTurtleId(turtles[0].id);
	}, [turtles, turtleId]);

	const [disableEvents, setDisableEvents] = useState(false);

	return (
		<TurtleContext.Provider value={[turtleId, setTurtleId, turtles]}>
			<div className={classes.root}>

				{
					turtles.map((t: Turtle) => (
						<TurtlePage setDisableEvents={setDisableEvents} enabled={turtleId === t.id} key={t.id} turtle={t} />
					))
				}
				{
					turtles.length === 0 && <div className={classes.message}>
						<Typography variant='h5' style={{'fontWeight': 'bold'}}>
							No turtles are connected
						</Typography>
					</div>
				}
				<WorldRenderer className={classes.world} turtle={selectedTurtle} world={world} disableEvents={disableEvents} />

			</div>
		</TurtleContext.Provider>
	);
};

export default IndexPage;
