<script>
  export let local;
  export let name;
  export let lastEditedIso;
  export let id;

  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();

  $: lastEditedStr = new Date(lastEditedIso).toLocaleString("en-US");
  $: docUrl = local ? "/doc/local-" + id : "/doc/" + id;
  $: lastEditedStr = local ? "Last edited: " + lastEditedStr : "Last edited by me: " + lastEditedStr;

  function onDelete() {
    if (!window.confirm("Delete this document? This cannot be undone.\n" + name)) return;
    dispatch("delete", id);
  }

</script>

<style lang="less">
  @import "../style-defines.less";
  p {
    display: flex; width: 100%; height: 60px; padding: 2px 6px; margin-left: -6px;
    &:hover { background-color: @hoverBgColor; }
    a { flex-grow: 1; text-decoration: none; color: inherit; border: 0; }
    span.op { width: 72px; text-align: right; cursor: default; color: @hotColor; display: none; }
    span.info { font-size: 80%; font-style: italic; }
    &:hover span.op { display: inline; }
  }
</style>

<p>
  <a class="ajax" href={docUrl}>
    <b>{name}</b><br/>
    <span class="info">Last edited: {lastEditedStr}</span>
  </a>
  <span class="op" on:click={onDelete}>Delete</span>
</p>
