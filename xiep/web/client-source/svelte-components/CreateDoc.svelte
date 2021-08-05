<script>
  import { onMount } from 'svelte';
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();
  let elmInput;
  let docName;

  onMount(() => {
    elmInput.focus();
  });

  function onOk() {
    let name = docName;
    if (!name) name = "";
    else name = name.trim();
    if (name.length == 0) name = "New document";
    dispatch("done", { result: "ok", name: name });
  }

  function onCancel() {
    dispatch("done", { result: "cancel" });
  }

  function onKeyDown(e) {
    if (e.key === "Enter") onOk();
    else if (e.key === "Escape") onCancel();
  }

</script>

<style lang="less">
  @import "../style-defines.less";
  p {
    display: flex; width: 100%; align-items: center;
  }
  input { 
    border: 2px solid @hotColor; border-radius: 6px; padding: 2px 6px; flex-grow: 1; margin-right: 5px;
  }
  span {
    margin-left: 6px;
    &.ok, &.cancel { border-bottom: 1pt dotted @hotColor; cursor: pointer; }
    &.ok { color: @hotColor; font-weight: bold; }
    &.cancel {  }
  }
</style>

<p>
  <input type="text" placeholder="New document" bind:this={elmInput} bind:value={docName} on:keydown={onKeyDown} />
  <span class="ok" on:click={onOk}>Create</span>
  <span>or</span>
  <span class="cancel" on:click={onCancel}>cancel</span>
</p>
