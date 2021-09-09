<script>
  import { createEventDispatcher } from 'svelte';
  import { onMount } from 'svelte'
  import Button from "./Button.svelte";
  var JQ = require("jquery");

  export let showCancelButton = true;

  const dispatch = createEventDispatcher();

  let secretInput;
  let secret = "";
  let resultMessage = "";
  $: loginEnabled = secret.length != 0;

  onMount(() => secretInput.focus());

  function onLoginClick() {
    if (secret.length == 0) return;
    var req = JQ.ajax({
      url: "/api/auth/login/",
      type: "POST",
      data: {
        secret: secret,
      }
    });
    req.done(function (data) {
      dispatch("done");
    });
    req.fail(function () {
      resultMessage = "Login failed.";
    });

  }

  function onCancelClick() {
    dispatch("done");
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
  input {
    border: 1pt solid @lightCursorColor; position: relative; float: right; width: 230px;
    padding: 2px 5px; margin-top: -2px;
  }
  p { margin-bottom: 0; width: 100%; }
  p.error { color: red; font-style: italic; }
  .buttons { text-align: right; }

</style>

<p>
  Enter your secret: <input type="password" bind:this={secretInput} bind:value={secret} on:keydown={onKeyDown} />
</p>
<p class="error">{resultMessage}&nbsp;</p>
<p class="buttons">
  <Button label="Log in" round={false} enabled={loginEnabled} on:click={onLoginClick} />
  {#if showCancelButton}
  <Button label="Cancel" round={false} enabled="true" on:click={onCancelClick} />
  {/if}
</p>
