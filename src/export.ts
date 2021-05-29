import { getInitialGridCell, GridCell, GridLayout, PIN_NONE, PIN_PERCENT, PIN_PIXEL } from "./absolute-layout";

export function layoutToStr(layout: GridLayout): string {
    function posToStr(pos: number, lockPos: number, pinMode: number): string {
        let s = `${Math.round(pinMode == PIN_NONE ? pos : lockPos)}`;
        if (pinMode == PIN_PIXEL) s += 'A';
        else if (pinMode == PIN_PERCENT) s += 'P';
        else if (pinMode == PIN_NONE) s += "N";
        return s;
    }

    let s = '';
    layout.forEach((g: GridCell) => {
        s +=
            posToStr(g.x0, g.xl0, g.xp0) +
            posToStr(g.y0, g.yl0, g.yp0) +
            posToStr(g.x1, g.xl1, g.xp1) +
            posToStr(g.y1, g.yl1, g.yp1) +
            "+";
    });

    return s;
}

export function strToLayout(s: string): GridLayout {
    let num = '';
    let numIdx = 0;
    let pinMode = PIN_NONE;
    let numEnd = false;
    let blockEnd = false;

    const grid: GridLayout = [];

    let cell: GridCell = getInitialGridCell(0, 0);

    for (let i = 0; i < s.length; i++) {
        if (s[i] >= '0' && s[i] <= '9') {
            num += s[i];
        } else if (s[i] === 'A') {
            pinMode = PIN_PIXEL;
        } else if (s[i] === 'P') {
            pinMode = PIN_PERCENT;
        } else if (s[i] === 'N') {
            numEnd = true;
        } else if (s[i] === '+') {
            blockEnd = true;
        }

        if (pinMode != PIN_NONE || numEnd) {
            const v = parseInt(num) || 0;
            if (numIdx === 0) {
                if (pinMode === PIN_NONE) {
                    cell.x0 = v;
                } else {
                    cell.xl0 = v;
                }
                cell.xp0 = pinMode;
            } else if (numIdx === 1) {
                if (pinMode === PIN_NONE) {
                    cell.y0 = v;
                } else {
                    cell.yl0 = v;
                }
                cell.yp0 = pinMode;
            } else if (numIdx === 2) {
                if (pinMode === PIN_NONE) {
                    cell.x1 = v;
                } else {
                    cell.xl1 = v;
                }
                cell.xp1 = pinMode;
            } else if (numIdx === 3) {
                if (pinMode === PIN_NONE) {
                    cell.y1 = v;
                } else {
                    cell.yl1 = v;
                }
                cell.yp1 = pinMode;
            }
            numIdx += 1;
            num = '';
            numEnd = false;
            pinMode = 0;
        } else if (blockEnd) {
            grid.push(cell);
            cell = getInitialGridCell(0, 0);
            numIdx = 0;
            blockEnd = false;
        }
    }
    return grid;
}
