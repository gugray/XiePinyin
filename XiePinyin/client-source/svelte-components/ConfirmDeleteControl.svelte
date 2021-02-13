<script>

  export let docName, docId;

  import { createEventDispatcher } from 'svelte';
  import { onMount } from 'svelte'
  import Button from "./Button.svelte";

  const dispatch = createEventDispatcher();

  function onDeleteClick() {
    dispatch("done", docId);
  }

  function onCancelClick() {
    dispatch("done", false);
  }

  function onKeyDown(e) {
    let handled = false;
    if (e.code == "Escape") {
      onCancelClick();
      handled = true;
    }
    if (e.code == "Enter") {
      onLoginClick();
      handled = true;
    }
    if (handled) {
      e.preventDefault();
      e.stopPropagation();
    }
  }

</script>

<style lang="less">
  @import "../style-defines.less";
  p { margin-bottom: 0; width: 100%; }
  p.error { color: red; font-style: italic; }
  .buttons { text-align: right; }
</style>

<p>
  Are you sure you want to delete this document? It cannot be restored later.<br /><br />
  Name: <i>{docName}</i>
</p>
<p class="buttons">
  <Button label="Delete" round={false} enabled="true" on:click={onDeleteClick} />
  <Button label="Cancel" round={false} enabled="true" on:click={onCancelClick} />
</p>
