// Marwood — karakterleri ayrı ayrı SVG olarak dışa aktar
//
// Kullanım (Illustrator):
//   1. .ai dosyasını açın.
//   2. Her karakter tek bir grup olsun (değilse karakteri seçip Cmd/Ctrl+G).
//   3. Karakterleri seçin (hepsi için Cmd/Ctrl+A).
//   4. Dosya > Komut Dosyaları > Diğer Komut Dosyası… (File > Scripts > Other
//      Script…) ve bu dosyayı seçin.
//   5. Bir klasör seçin. İçinde "marwood-svg" klasörü oluşur: her karakter
//      için bir SVG, tüm belge için bir SVG ve manifest.json. Bu klasörü
//      Claude'a gönderin.
//
// Script çizimi değiştirmez: her karakteri geçici bir belgeye kopyalar,
// dışa aktarır ve geçici belgeyi kaydetmeden kapatır.
#target illustrator

(function () {
  if (app.documents.length === 0) {
    alert("Önce karakterlerin olduğu .ai dosyasını açın.");
    return;
  }
  var doc = app.activeDocument;
  var MARGIN = 10; // pt, artboard padding around each character

  var items = [];
  var sel = doc.selection;
  if (sel && sel.length) {
    for (var i = 0; i < sel.length; i++) items.push(sel[i]);
  } else if (!confirm("Seçili karakter yok.\n\nSadece tüm belgeyi tek SVG olarak dışa aktarayım mı?\n" +
                      "(Karakterleri ayrı ayrı almak için önce seçip scripti yeniden çalıştırın.)")) {
    return;
  }

  var base = Folder.selectDialog("SVG dosyalarının kaydedileceği klasörü seçin");
  if (!base) return;
  var out = new Folder(base.fsName + "/marwood-svg");
  if (!out.exists) out.create();

  // left-to-right numbering
  items.sort(function (a, b) { return a.visibleBounds[0] - b.visibleBounds[0]; });

  var prevLevel = app.userInteractionLevel;
  app.userInteractionLevel = UserInteractionLevel.DONTDISPLAYALERTS;

  var report = [];
  var warnings = [];
  var used = {};
  try {
    for (var k = 0; k < items.length; k++) {
      var item = items[k];
      var name = uniqueName(slug(item.name) || pad("karakter-", k + 1), used);
      var stats = { groups: 0, paths: 0, compound: 0, rasters: 0, placed: 0, texts: 0, symbols: 0, other: 0 };
      count(item, stats);
      exportItem(item, name, new File(out.fsName + "/" + name + ".svg"));
      report.push({ name: name, layerName: item.name || "", bounds: item.visibleBounds, stats: stats });
      if (stats.rasters + stats.placed > 0 && stats.paths + stats.compound < 10) {
        warnings.push(name + ": vektör değil, gömülü resim gibi görünüyor.");
      }
    }
    doc.activate();
    exportSVG(doc, new File(out.fsName + "/tum-belge.svg"));
    writeManifest(new File(out.fsName + "/manifest.json"), report);
  } catch (e) {
    app.userInteractionLevel = prevLevel;
    alert("Bir hata oldu:\n" + e.message + (e.line ? " (satır " + e.line + ")" : ""));
    return;
  }
  app.userInteractionLevel = prevLevel;

  alert((items.length ? items.length + " karakter" : "Tüm belge") + " dışa aktarıldı:\n" + out.fsName +
        (warnings.length ? "\n\nUyarı:\n" + warnings.join("\n") : "") +
        "\n\nBu klasörü Claude'a gönderin.");

  // ── helpers ──────────────────────────────────────────────────────────

  function exportItem(src, layerName, file) {
    var b = src.visibleBounds; // [left, top, right, bottom]
    var w = Math.max(b[2] - b[0] + 2 * MARGIN, 10);
    var h = Math.max(b[1] - b[3] + 2 * MARGIN, 10);
    var tmp = app.documents.add(doc.documentColorSpace, w, h);
    try {
      var dup = src.duplicate(tmp.layers[0], ElementPlacement.PLACEATBEGINNING);
      var vb = dup.visibleBounds;
      tmp.artboards[0].artboardRect = [vb[0] - MARGIN, vb[1] + MARGIN, vb[2] + MARGIN, vb[3] - MARGIN];
      tmp.layers[0].name = layerName;
      exportSVG(tmp, file);
    } finally {
      tmp.close(SaveOptions.DONOTSAVECHANGES);
      doc.activate();
    }
  }

  // Strokes stay strokes, object/layer names become ids, text becomes outlines.
  function exportSVG(target, file) {
    try {
      var o = new ExportOptionsWebOptimizedSVG();
      o.coordinatePrecision = 3;
      o.cssProperties = SVGCSSPropertyLocation.PRESENTATIONATTRIBUTES;
      o.fontType = SVGFontType.OUTLINEFONT;
      o.rasterImageLocation = RasterImageLocation.EMBED;
      o.svgId = SVGIdType.SVGIDREGULAR;
      o.svgMinify = false;
      o.svgResponsive = false;
      target.exportFile(file, ExportType.WOSVG, o);
    } catch (e) {
      // older Illustrator: classic SVG export
      var c = new ExportOptionsSVG();
      c.coordinatePrecision = 3;
      c.cssProperties = SVGCSSPropertyLocation.PRESENTATIONATTRIBUTES;
      c.fontType = SVGFontType.OUTLINEFONT;
      c.embedRasterImages = true;
      c.documentEncoding = SVGDocumentEncoding.UTF8;
      c.preserveEditability = false;
      target.exportFile(file, ExportType.SVG, c);
    }
  }

  function count(it, s) {
    switch (it.typename) {
      case "GroupItem":
        s.groups++;
        for (var i = 0; i < it.pageItems.length; i++) count(it.pageItems[i], s);
        break;
      case "PathItem": s.paths++; break;
      case "CompoundPathItem": s.compound++; break;
      case "RasterItem": s.rasters++; break;
      case "PlacedItem": s.placed++; break;
      case "TextFrame": s.texts++; break;
      case "SymbolItem": s.symbols++; break;
      default: s.other++;
    }
  }

  function slug(str) {
    if (!str) return "";
    var map = { "ç": "c", "Ç": "c", "ğ": "g", "Ğ": "g", "ı": "i", "İ": "i", "ö": "o", "Ö": "o",
                "ş": "s", "Ş": "s", "ü": "u", "Ü": "u" };
    var s = "";
    for (var i = 0; i < str.length; i++) s += map[str.charAt(i)] || str.charAt(i);
    return s.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  }

  function uniqueName(n, seen) {
    var name = n, i = 2;
    while (seen[name]) name = n + "-" + i++;
    seen[name] = true;
    return name;
  }

  function pad(prefix, n) { return prefix + (n < 10 ? "0" : "") + n; }

  // ExtendScript has no JSON object, so write the manifest by hand
  function writeManifest(file, rows) {
    var q = function (v) { return '"' + String(v).replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"'; };
    var lines = [];
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i], st = [];
      for (var key in r.stats) st.push(q(key) + ": " + r.stats[key]);
      var bounds = [];
      for (var j = 0; j < 4; j++) bounds.push(Math.round(r.bounds[j] * 100) / 100);
      lines.push("    {" + q("file") + ": " + q(r.name + ".svg") + ", " + q("layerName") + ": " + q(r.layerName) +
                 ", " + q("bounds") + ": [" + bounds.join(", ") + "], " + q("stats") + ": {" + st.join(", ") + "}}");
    }
    file.encoding = "UTF-8";
    file.open("w");
    file.write("{\n  " + q("source") + ": " + q(doc.name) + ",\n  " + q("characters") + ": [\n" +
               lines.join(",\n") + "\n  ]\n}\n");
    file.close();
  }
})();
