import webview from '@ohos.web.webview';

const LOCAL_URL: string = 'http://127.0.0.1:3001';

@Entry
@Component
struct Index {
  private controller: webview.WebviewController = new webview.WebviewController();
  @State canGoBack: boolean = false;
  @State loading: boolean = true;

  build() {
    Column() {
      Row() {
        Text('灵犀 LingXi')
          .fontSize(18)
          .fontWeight(FontWeight.Bold)
          .fontColor('#111827')
        Blank()
        Button('刷新')
          .height(34)
          .fontSize(13)
          .backgroundColor('#059669')
          .fontColor(Color.White)
          .borderRadius(10)
          .onClick(() => {
            this.controller.refresh();
          })
      }
      .width('100%')
      .height(54)
      .padding({ left: 16, right: 16 })
      .backgroundColor('#F8FAFC')

      Stack() {
        Web({ src: LOCAL_URL, controller: this.controller })
          .javaScriptAccess(true)
          .domStorageAccess(true)
          .onlineImageAccess(true)
          .mixedMode(MixedMode.All)
          .width('100%')
          .height('100%')
          .onPageBegin(() => {
            this.loading = true;
          })
          .onPageEnd(() => {
            this.loading = false;
            this.canGoBack = this.controller.accessBackward();
          })

        if (this.loading) {
          Column() {
            LoadingProgress()
              .width(42)
              .height(42)
              .color('#059669')
            Text('正在连接灵犀...')
              .fontSize(14)
              .fontColor('#64748B')
              .margin({ top: 12 })
          }
          .justifyContent(FlexAlign.Center)
          .width('100%')
          .height('100%')
          .backgroundColor('#F8FAFC')
        }
      }
      .layoutWeight(1)
      .width('100%')
    }
    .width('100%')
    .height('100%')
  }
}
