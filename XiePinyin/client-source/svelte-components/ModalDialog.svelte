<script>
  export let title;

</script>

<style lang="less">
  @import "../style-defines.less";
  .modal {
    position: fixed; top: 0; left: 0; right: 0; bottom: 0; padding-top: 10%;
    background-color: #00000070;
    .noselect();
    .box {
      width: 420px; height: auto; margin: 0 auto;
      border: 1pt solid @borderColor; background-color: white;
      h2 { 
        margin: 0; padding: 5px; font-size: @fntSizePinyin * 1.2; font-weight: bold;
        color: white; background-color: @borderColor;
      }
    .content { width: 100%; padding: 10px; }
    }
  }
</style>

<section class="login modal">
  <div class="box">
    <h2>{title}</h2>
    <div class="content">
      <slot></slot>
    </div>
  </div>
</section>
