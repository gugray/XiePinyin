<script>
  export let name;
  export let inputType = "simp";

  import { createEventDispatcher } from 'svelte';
	const dispatch = createEventDispatcher();

  function onInputType(val) {
    inputType = val;
    dispatch("inputType", { val: val });
  }

  function onCloseClicked() {
    dispatch("close");
  }

</script>

<style lang="less">
  @import "../style-defines.less";
  .title { padding: 5px 15px 0 15px; height: 36px; font-size: 110%; }
  .commands { 
    padding: 0 15px; height: 39px; cursor: default;
    .group { position: relative; float: left; }
    .item { 
      margin-left: 2px; position: relative; float: left;
      &:first-of-type { margin-left: -4px; }
    }
    .button {
      padding: 2px 5px 4px 5px; border: 2px solid transparent;
      &.sel, &.sel:hover { background-color: @selectionColor; }
      &:hover { background-color: @hoverBgColor; }
    }
  }
  .close {
    position: absolute; right: 30px; top: 10px; padding: 2px 10px 4px 10px; cursor: default;
    background-color: @selectionColor; &:hover { background-color: @hoverBgColor; }
  }
</style>

<div class="title">
  <div class="docTitle"><span>{name}</span></div>
</div>
<div class="commands">
  <div class="group grpInputType">
    <div class="item button" class:sel={inputType == "simp"} on:click={ e=> onInputType('simp') }>简体</div>
    <div class="item button" class:sel={inputType == "trad"} on:click={ e=> onInputType('trad') }>繁體</div>
  </div>
</div>
<div class="close" on:click={onCloseClicked}>Close</div>