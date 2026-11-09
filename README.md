# EWM Dock Inspection

A browser prototype for pairing an inbound handling-unit scan with a packaging photo. A pixel detector checks a blue seal for a visible gap. The receiving operator reviews the finding and saves an evidence record for the delivery.

## Run the demo

Open `index.html` from the extracted project directory, or serve the directory with `python -m http.server 8000` and visit `http://localhost:8000`.

1. Select **Use sample HU-1001**. The mock receipt shows 20 cartons on delivery **DEMO-180002142**.
2. Select **Try broken seal**. The app draws a sample receiving photo, examines its pixels and highlights the suspected break.
3. Enter a note and select **Confirm damage**. The app saves the review in browser storage.
4. Select **Export evidence**. The JSON package includes the receipt, image, model assessment, operator decision, timestamp, and note.
5. Try **Try intact seal** or **Open photo**. For a real close-up, align a blue seal across the middle strip as shown in the samples.

The samples are generated in code. The image check is a deterministic color and continuity rule for a controlled camera view. It has no trained model or field accuracy claims. The app uses a mock SAP receipt lookup and does not post to SAP. No images or notes are sent to a server.

## Test

```sh
node --test inspection.test.cjs
```

## SAP sandbox integration

The boundary is the receipt lookup and the approved evidence record. A production implementation would resolve the scan through an authorized service, confirm the warehouse and delivery relationship, and store the approved photo using the supported attachment mechanism for the target EWM release and object. Use the inspection event ID as an idempotency key for retries. The receiving operator continues to own the disposition decision and SAP posting.

- [Warehouse inbound delivery API operations](https://help.sap.com/docs/SUPPORT_CONTENT/sewm/4180682552.html)
- [SAP EWM attachment capability](https://help.sap.com/docs/SAP_S4HANA_ON-PREMISE/9832125c23154a179bfa1784cdc9577a/e7032486a72f4705b865ff02541f0ccb.html)

## GitHub Pages

The project is static. After pushing it to GitHub, use **Settings → Pages → Deploy from a branch**, choose **main** and **/(root)**, then save. [GitHub Pages setup](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
