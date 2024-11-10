// eslint-disable-next-line max-classes-per-file -- FIXME: Refactor into multiple files.
import { $print } from "rbxts-transform-debug";

import type { ZrValue } from "./locals";

export abstract class ZrUserdata<T> {
	public abstract value(): T;

	public abstract isInstance(): this is ZrInstanceUserdata;
	public abstract isObject<T>(object: new () => T): this is ZrObjectUserdata<T>;

	public static fromInstance<TInstance extends Instance>(
		instance: TInstance,
	): ZrInstanceUserdata<TInstance> {
		return new ZrInstanceUserdata(instance);
	}

	public static fromLazyInstance<TInstance extends Instance>(
		lazyFunc: () => TInstance,
	): ZrInstanceUserdata<TInstance> {
		return new ZrInstanceUserdata(lazyFunc);
	}

	public static fromRecord<T extends Record<string, ZrValue>>(record: T): ZrObjectUserdata<T> {
		return new ZrObjectUserdata(record);
	}

	public static fromObject<TObject extends defined>(object: TObject): ZrObjectUserdata<TObject> {
		return new ZrObjectUserdata(object);
	}
}

type PickZrValues<T> = { [P in keyof T]: T[P] extends ZrValue ? P : never }[keyof T];
export type InferUserdataKeys<T> = T extends ZrInstanceUserdata<infer A> ? PickZrValues<A> : never;

export class ZrObjectUserdata<T extends defined> extends ZrUserdata<T> {
	constructor(private readonly object: T) {
		super();
	}

	public isInstance(): boolean {
		return false;
	}

	public isObject<T>(klass: new () => T): this is ZrObjectUserdata<T> {
		return this.object instanceof klass;
	}

	public toString(): string {
		return "toString" in this.object ? tostring(this.object) : "[ZrObjectUserdata]";
	}

	public value(): T {
		return this.object;
	}
}

type MappedValues<T extends Instance> = T extends Instance ? ZrInstanceUserdata<T> : T;

export class ZrInstanceUserdata<T extends Instance = Instance> extends ZrUserdata<T> {
	constructor(private instance: (() => T) | T) {
		super();
	}

	public isInstance(): boolean {
		return true;
	}

	public isObject(value: unknown): boolean {
		return false;
	}

	public toString(): string {
		return tostring(this.value());
	}

	/**
	 * Gets the property.
	 *
	 * @param name - The name of the property.
	 * @throws If the property isn't valid.
	 * @internal
	 */
	public get<K extends PickZrValues<T> & string>(name: K): T[K] | ZrValue {
		if (typeIs(this.instance, "function")) {
			this.instance = this.instance();
		}

		const value = this.instance[name];
		if (typeIs(value, "function")) {
			throw `Cannot index function`;
		} else if (typeIs(value, "Instance")) {
			return new ZrInstanceUserdata(value);
		} else {
			return value;
		}
	}

	public value(): T {
		if (typeIs(this.instance, "function")) {
			this.instance = this.instance();
			$print("lazyGet", this.instance);
		}

		return this.instance;
	}

	public isA<T extends keyof Instances>(className: T): this is ZrInstanceUserdata<Instances[T]> {
		return this.value().IsA(className);
	}
}
