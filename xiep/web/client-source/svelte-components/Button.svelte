<script>
  export let label;
  export let round = true;
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
    font-size: @fntSizePinyin; padding: 1px 8px 3px 8px;
    cursor: default;
    &.enabled:hover { background-color: @buttonHoverColor; }
    &.enabled { background-color: @buttonColor; }
    &.round { border-radius: 5px; }
  }

</style>

<div class="button" class:round class:enabled on:click={onClick}>{label}</div>
