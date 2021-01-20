<script>

	import { localStore } from "./localStore";
	import { getRandomId } from "./idGenerator";
	import Button from "./Button.svelte";
	import DocListItem from "./DocListItem.svelte";
	import CreateDoc from "./CreateDoc.svelte";

	let localDocs = localStore("docs", []);
	let creatingLocal = false;

	function onClickCreateLocal() {
		creatingLocal = true;
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
				paras: [[]]
			};
			localStorage.setItem("doc-" + id, JSON.stringify(docData));
		}
		creatingLocal = false;
	}

	function onDeleteLocal(e) {
		const id = e.detail;
		let docs = $localDocs;
		docs = docs.filter(itm => itm.id != id);
		localDocs.set(docs);
		let docDataJson = localStorage.getItem("doc-" + id);
    if (docDataJson) localStorage.removeItem("doc-" + id);
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
	<p>You don't have any documents yet. <span class="linkish" on:click={onClickCreateLocal} >Create one</span> now!</p>
	{/if}

	{#each $localDocs as doc}
	<DocListItem name={doc.name} id={doc.id} local lastEditedIso={doc.lastEditedIso} on:delete={onDeleteLocal} />
	{/each}

	<h2>Online documents</h2>
	<p>
		This function is still work in progress. Instead, you can<br />
		<a href="/doc/sample" class="ajax">edit a sample document</a>.
	</p>
</article>
