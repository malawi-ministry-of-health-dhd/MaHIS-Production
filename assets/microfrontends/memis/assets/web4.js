import { W as WebPlugin } from './Layout.js';

class PrinterWeb extends WebPlugin {
    async print() {
        console.log('Not supported web browsers!');
        return Promise.reject('Printer plugin is not supported on web.');
    }
}

export { PrinterWeb };
