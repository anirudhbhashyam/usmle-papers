# Form 16 Practice Exam

A static practice exam with 200 questions, timed blocks, a question navigator, flagging, answer elimination, and block review.

## Run locally

Open `index.html` in a browser. For the same setup as GitHub Pages, serve this directory over HTTP.

```sh
python3 -m http.server 8000
```

Visit [localhost:8000](http://localhost:8000).

Drag across question or answer text to highlight it. Progress and annotations are stored in the browser on the current device. Each item includes a reference image. Results show completion and saved responses.

Select **Reset exam** in the top toolbar and confirm to erase the entire saved attempt. You can do this during a block, between blocks, or after finishing.

## Publish on GitHub Pages

Put the contents of this directory at the repository root. In the repository's **Settings → Pages**, choose **Deploy from a branch**, then select the branch containing `index.html` and **/ (root)**. No build command is required. Keep the `assets` directory next to `index.html` so question images resolve at the repository's Pages URL.

The default uses 10 blocks of 20 questions and 30 minutes each. Choose **Original form sections** for four 50-question blocks of 75 minutes each, or **Custom** to set the questions and minutes per block.
