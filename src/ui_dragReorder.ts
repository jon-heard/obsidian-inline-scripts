//////////////////////////////////////////////////////////////////////////////////
// DragReorder - A class to handle reordering html elements through drag-and-drop. //
//////////////////////////////////////////////////////////////////////////////////

"use strict";

export class DragReorder
{
	preDragDistanceSqr: number = 200;
	container: any = null;
	items: Array<any> =  null;
	dragged: any = null;
	downPoint: Array<number> = null;
	onDragged: Function = null;

	constructor(container: any, onDragged?: Function, dragScale?: number)
	{
		dragScale ||= 0.5;
		this.onDragged = onDragged;
		this.container = container;
		container.classList.add("iscript_drag_container");
		const emSize =
			Number(window.getComputedStyle(container, null).
			getPropertyValue("font-size").replace("px",""));
		this.preDragDistanceSqr = Math.pow(emSize, 2) * dragScale;
		this.items = [];
		for (let item of container.childNodes)
		{
			if (!item.classList) { continue; }
			this.items.push(item);
			item.classList.add("iscript_drag_item");
			item.addEventListener("pointerdown", (evt: any) =>
			{
				this.downPoint = [ evt.offsetX, evt.offsetY ];
			});
			item.addEventListener("pointermove", (evt: any) =>
			{
				if (this.dragged || !this.downPoint) { return; }
				const distance =
					Math.pow(this.downPoint[0] - evt.offsetX, 2) +
					Math.pow(this.downPoint[1] - evt.offsetY, 2);
				if (distance > this.preDragDistanceSqr)
				{
					this.initDrag(evt.target);
				}
			});
			item.addEventListener("pointerenter", (evt: any) =>
			{
				if (this.dragged && evt.target !== this.dragged)
				{
					this.dragOver(evt.target);
				}
			});
			item.addEventListener("pointerout", (evt: any) =>
			{
				if (this.dragged || !this.downPoint) { return; }
				this.initDrag(evt.target);
			});
			item.addEventListener("gotpointercapture",
				(e: any) => e.target.releasePointerCapture(e.pointerId));
		}
		document.addEventListener("pointerup", () =>
		{
			if (this.downPoint) { this.downPoint = null; }
			if (this.dragged) { this.endDrag(); }
		});
	}

	initDrag(item: any): void
	{
		this.dragged = item;
		this.container.classList.add("iscript_drag_container_dragging");
		this.dragged.classList.add("iscript_drag_item_dragged");
		for (const item of this.items)
		{
			if (item === this.dragged) { continue; }
			item.classList.add("iscript_drag_item_notDragged");
		}
	}

	dragOver(target: any): void
	{
		for (const child of this.container.getElementsByClassName("iscript_drag_item"))
		{
			if (child === this.dragged)
			{
				this.dragged.parentNode.insertBefore(this.dragged, target);
				this.dragged.parentNode.insertBefore(target, this.dragged);
				break;
			}
			else if (child === target)
			{
				this.dragged.parentNode.insertBefore(this.dragged, target);
				break;
			}
		}
	}

	endDrag(): void
	{
		this.container.classList.remove("iscript_drag_container_dragging");
		this.dragged.classList.remove("iscript_drag_item_dragged");
		for (const item of this.items)
		{
			item.classList.remove("iscript_drag_item_notDragged");
		}
		this.dragged = null;
		this.onDragged?.();
	}
}
