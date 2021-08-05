import StartPage from './StartPage.svelte';
import EditorHeader from './EditorHeader.svelte';
import LoginControl from './LoginControl.svelte';

window.Comps = window.Comps || {};

window.Comps.StartPage = function (options) { return new StartPage(options); };
window.Comps.EditorHeader = function (options) { return new EditorHeader(options); };
window.Comps.LoginControl = function (options) { return new LoginControl(options); };