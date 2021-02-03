<script>

	import { localStore } from "./localStore";
	import { getRandomId } from "./idGenerator";
	import Button from "./Button.svelte";
  import ConfirmDelete from "./ConfirmDelete.svelte";
	import LoginWindow from "./LoginWindow.svelte";
	import DocListItem from "./DocListItem.svelte";
	import CreateDoc from "./CreateDoc.svelte";
	var JQ = require("jquery");
	var auth = require("../auth.js");

	let localDocs = localStore("docs", []);
	let onlineDocs = localStore("online-docs", []);
	let creatingLocal = false;
	let creatingOnline = false;
	let isLoggedIn = auth.isLoggedIn();
	$: logInOutText = isLoggedIn ? "Log out" : "Log in";
	let showLogin = false;
	let showConfirmDelete = false;
	let docToDelName, docToDelId;

	function showError(message) {
		console.log("Error: " + message);
	}

	function onClickCreateLocal() {
		creatingLocal = true;
	}

	function onClickCreateOnline() {
		creatingOnline = true;
	}

	function onCreateLocalDone(e) {
		if (e.detail.result == "ok") {
			let id;
			let docs = $localDocs;
			while (true) {
				id = getRandomId();
				var x = docs.find(itm => itm.id == id);
				if (!x) break;
			}
			docs.unshift({ name: e.detail.name, lastEditedIso: new Date().toISOString(), id: id });
			localDocs.set(docs);
			let docData = {
				xieText: []
			};
			localStorage.setItem("doc-" + id, JSON.stringify(docData));
		}
		creatingLocal = false;
	}

	function onCreateOnlineDone(e) {
		if (e.detail.result == "ok") {
			var req = JQ.ajax({
				url: "/api/doc/create/",
				type: "POST",
				data: {
					name: e.detail.name,
				}
			});
			req.done(function (data) {
				let id = data.data;
				if (!id) showError("Something went wrong.");
				else {
					let docs = $onlineDocs;
					docs.unshift({ name: e.detail.name, lastEditedIso: new Date().toISOString(), id: id });
					onlineDocs.set(docs);
				}
			});
			req.fail(function () {
				showError("Failed to create online document.");
			});
		}
		creatingOnline = false;
	}

	function onDeleteLocal(e) {
		const id = e.detail;
		let docs = $localDocs;
		docs = docs.filter(itm => itm.id != id);
		localDocs.set(docs);
		let docDataJson = localStorage.getItem("doc-" + id);
		if (docDataJson) localStorage.removeItem("doc-" + id);
	}

	function onDeleteOnline(e) {
		docToDelId = e.detail.id;
		docToDelName = e.detail.name;
		showConfirmDelete = true;
	}
	
	function onConfirmDeleteDone(e) {
		showConfirmDelete = false;
		if (!e.detail) return;
    const id = e.detail;
    var req = JQ.ajax({
      url: "/api/doc/delete/",
      type: "POST",
      data: {
        docId: id,
      }
    });
    req.done(function (data) {
      if (data.result != "OK") showError("Something went wrong.");
      else {
        let docs = $onlineDocs;
        docs = docs.filter(itm => itm.id != id);
        onlineDocs.set(docs);
      }
    });
    req.fail(function () {
      showError("Failed to delete online document.");
    });
  }

	function onClickLogInOut() {
		isLoggedIn = auth.isLoggedIn();
		if (!isLoggedIn) showLogin = true;
		else {
			var req = JQ.ajax({
				url: "/api/auth/logout/",
				type: "POST",
			});
			req.done(function (data) {
				isLoggedIn = auth.isLoggedIn();
			});
			req.fail(function () {
				isLoggedIn = auth.isLoggedIn();
			});
		}
	}

	function onLoginDone() {
		showLogin = false;
		isLoggedIn = auth.isLoggedIn();
	}

</script>

<style lang="less">
  @import "../style-defines.less";
	article { cursor: default; }
	h1 { 
		width: 100%;
		span { border-bottom: 3px solid #303030; }
		//span { border-bottom: 3px solid #985700; }
		:global(.button) { display: block; float: right; margin-top: 10px; }
		img { width: 64px; vertical-align: top; }
	}
	h2 {
		font-weight: normal; font-size: 27px;
		:global(.button) { margin-left: 10px; }
	}
	span.linkish {
		color: @hotColor; border-bottom: 1pt dotted @hotColor; text-decoration: none;
		&:hover { border-bottom: 1pt solid @hotColor; }
	}
</style>

<article>
	<h1><img src="/xie-with-label.svg" alt="Fictive xiě character" /> <span>Biscriptal Editor</span> <Button label="{logInOutText}" enabled="true" on:click={onClickLogInOut} /></h1>

	{#if showLogin}
	<LoginWindow on:done={onLoginDone} />
	{/if}
	{#if showConfirmDelete}
	<ConfirmDelete on:done={onConfirmDeleteDone} docName={docToDelName} docId={docToDelId} />
	{/if}

	<h2>
		Your documents
		{#if isLoggedIn}
		<Button label="Create" enabled={!creatingOnline} on:click={onClickCreateOnline} />
		{/if}
	</h2>
	{#if creatingOnline}
	<CreateDoc on:done={onCreateOnlineDone} />
	{/if}
	{#if isLoggedIn}
	{#if $onlineDocs.length == 0}
	<p>You haven't edited any documents yet. <span class="linkish" on:click={onClickCreateOnline}>Create one</span> now!</p>
	{/if}
	{#each $onlineDocs as doc}
	<DocListItem name={doc.name} id={doc.id} online lastEditedIso={doc.lastEditedIso} on:delete={onDeleteOnline} />
	{/each}
	{/if}
	{#if !isLoggedIn}
	<p>To create and edit documents, please <span class="linkish" on:click={onClickLogInOut}>log in</span>.</p>
	{/if}
</article>
