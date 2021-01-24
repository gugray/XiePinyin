<script>

	import { localStore } from "./localStore";
	import { getRandomId } from "./idGenerator";
	import Button from "./Button.svelte";
	import DocListItem from "./DocListItem.svelte";
	import CreateDoc from "./CreateDoc.svelte";
	var JQ = require("jquery");

	let localDocs = localStore("docs", []);
	let onlineDocs = localStore("online-docs", []);
	let creatingLocal = false;
	let creatingOnline = false;

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
		const id = e.detail;
		var req = JQ.ajax({
			url: "/api/doc/delete/",
			type: "POST",
			data: {
				id: id,
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

</script>

<style lang="less">
  @import "../style-defines.less";
	article { cursor: default; }
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
	<h1>写拼音 Biscriptal Editor</h1>

	<h2>Documents in your browser <Button label="Create" enabled={!creatingLocal} on:click={onClickCreateLocal} /></h2>
	{#if creatingLocal}
	<CreateDoc on:done={onCreateLocalDone} />
	{/if}
	{#if $localDocs.length == 0}
	<p>You don't have any documents yet. <span class="linkish" on:click={onClickCreateLocal}>Create one</span> now!</p>
	{/if}
	{#each $localDocs as doc}
	<DocListItem name={doc.name} id={doc.id} local lastEditedIso={doc.lastEditedIso} on:delete={onDeleteLocal} />
	{/each}

	<h2>Online documents <Button label="Create" enabled={!creatingOnline} on:click={onClickCreateOnline} /></h2>
	{#if creatingOnline}
	<CreateDoc on:done={onCreateOnlineDone} />
	{/if}
	{#if $onlineDocs.length == 0}
	<p>You haven't edited any online documents yet. <span class="linkish" on:click={onClickCreateOnline}>Create one</span> now!</p>
	{/if}
	{#each $onlineDocs as doc}
	<DocListItem name={doc.name} id={doc.id} online lastEditedIso={doc.lastEditedIso} on:delete={onDeleteOnline} />
	{/each}

	<h2>Sample</h2>
	<p>
		Or, you can <a href="/doc/sample" class="ajax">edit a sample document</a>.
	</p>
</article>
