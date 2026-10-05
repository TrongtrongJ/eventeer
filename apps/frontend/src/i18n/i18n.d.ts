type Messages = typeof import('./messages/en.json');

// 2. Extend the global IntlMessages interface
declare interface IntlMessages extends Messages {}