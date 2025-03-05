using Microsoft.Playwright;

var playwright = await Playwright.CreateAsync();

// Browser'ı başlat  
var browser = await playwright.Chromium.LaunchAsync(new BrowserTypeLaunchOptions
{
    Headless = false,
    SlowMo = 40
    
});

var page = await browser.NewPageAsync();

// Örnek olarak bir e-ticaret sitesinden ürün bilgilerini çekelim  
await page.GotoAsync("https://www.ntv.com.tr/");

// Ürün kartlarını seçme  
var products = await page.QuerySelectorAllAsync(".slick-slide");

foreach (var product in products)
{
    // Ürün başlığını alma  
    var titleElement = await product.QuerySelectorAsync("ntv-main-slider-item-first-title");
    var title = await titleElement.TextContentAsync();

    Console.WriteLine($"Haber: {title}");
    Console.WriteLine("------------------------");
}

await browser.CloseAsync();
