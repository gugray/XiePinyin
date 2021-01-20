<script>
  export let label;
  export let enabled = false;

  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();

  function onClick() {
    if (!enabled) return;
    dispatch("click");
  }

</script>

<style lang="less">
  @import "../style-defines.less";
  .button {
    display: inline-block; color: white; background-color: #a8a8a8;
    font-size: @fntSizePinyin; padding: 1px 8px 3px 8px; border-radius: 5px;
    cursor: default;
    &.enabled:hover { background-color: @buttonHoverColor; }
    &.enabled { background-color: @buttonColor; }
  }

</style>

<div class="button" class:enabled on:click={onClick}>{label}</div>
