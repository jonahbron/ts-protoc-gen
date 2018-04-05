import { Printer } from './Printer';
export declare class CodePrinter {
    depth: number;
    printer: Printer;
    indentation: string;
    constructor(depth: number, printer: Printer);
    indent(): this;
    dedent(): this;
    printLn(line: string): this;
}
