export function log(tag: 'EXECUTE' | 'RESULT' | 'ASSERT' | 'PASS' | 'FAIL', message: string): void {
  console.log(`[${tag.padEnd(7)}] ${message}`);
}

export const execute = (call: string) => log('EXECUTE', call);
export const result  = (val: unknown) => log('RESULT', JSON.stringify(val, null, 0));
export const assert  = (expr: string) => log('ASSERT', expr);
export const pass    = (id: string)   => log('PASS', id);
export const fail    = (id: string, err: string) => log('FAIL', `${id}: ${err}`);
