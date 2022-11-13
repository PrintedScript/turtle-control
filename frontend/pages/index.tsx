// import Link from 'next/link';
import React, { createContext, Dispatch, SetStateAction, useEffect, useState } from 'react';
import TurtlePage from '../components/Turtle';
import { EventEmitter } from 'events';
import WorldRenderer from '../components/World';
import { makeStyles } from '@material-ui/core';

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

	// i moved these functions to the window because i couldnt figure out why it wasnt showing up in the turtle class
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

	useEffect( () => {
		window.setTurtles = (array: any[]) => {
			setTurtles(array.map(turtle => new Turtle(turtle)));
		};
		window.setWorld = setWorld;

		window.turtle_websocket = new WebSocket('ws://localhost:5758');
		window.turtle_websocket.addEventListener("message", async (event) => {
			const data = JSON.parse(event.data);
			if (data.type === 'world') {
				setWorld(data.data);
			} else if (data.type === 'turtles') {
				setTurtles(JSON.parse(data.data));
			} else if (data.type === 'blockupdate') {
				const block = data.data;
				world[block.x + ',' + block.y + ',' + block.z] = block.block;
				console.log(world)
				setWorld(world);
			} else if (data.type === 'removeblock') {
				const block = data.data;
				delete world[block.x + ',' + block.y + ',' + block.z];
				setWorld(world);
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
		window.suck = async (index : number, dir: BlockDirection) => {
			return window.exec(index, 'suckItem', dir);
		}
		window.dig = async (index : number, dir: BlockDirection) => {
			return window.exec(index, 'dig', dir);
		}
		window.drop = async (index : number, dir: BlockDirection) => {
			return window.exec(index, 'dropItem', dir);
		}
		window.refreshData = () => {
			window.turtle_websocket.send(JSON.stringify({
				type: 'refresh'
			}));
		}
		window.place = async (id: number, dir: BlockDirection, signText?: string) => {
			return window.exec(id, 'place', dir, signText);
		}
		window.move = async (id:number, direction: string) => {
			return window.exec(id, direction);
		}
		window.mineTunnel = async (id:number, direction: string, length: number) => {
			return window.exec(id, 'mineTunnel', direction, length);
		}
		window.craft = async (id:number, amount: string) => {
			if (amount != null ){
				return window.exec(id, 'craft', amount);
			}
		}
		window.refresh = async (id:number) => {
			return window.exec(id, 'refresh');
		}
		window.undergoMitosis = async (id:number) => {
			return window.exec(id, 'undergoMitosis');
		}
		window.refuel = async (id:number, count?: number) => {
			return window.exec(id, 'refuel', count);
		}
		window.selectSlot = async (id:number, slot: number) => {
			return window.exec(id, 'selectSlot', slot);
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
				<WorldRenderer className={classes.world} turtle={selectedTurtle} world={world} disableEvents={disableEvents} />

			</div>
		</TurtleContext.Provider>
	);
};

export default IndexPage;
