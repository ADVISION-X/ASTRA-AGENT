import { writeFileSync } from "node:fs";

type FixtureVideo = {
  id: string;
  title: string;
  author: string;
  description: string;
  likesText: string;
  commentsText: string;
  sharesText: string;
  shopHref: string;
  comments: string[];
};

const fixtureVideos: FixtureVideo[] = [
  {
    id: "video-1",
    title: "Steam Mop Product Review #cleanhome",
    author: "@creator_clean",
    description: "A product demo with shop link, buying guide, and pain-point fix.",
    likesText: "Likes 1.2K",
    commentsText: "Comments 12",
    sharesText: "Shares 4.5M",
    shopHref: "/shop/steam-mop",
    comments: ["Comment: Where can I buy this?", "Comment: Does the mop really remove stains?", "Comment: Is there a discount link?"],
  },
  {
    id: "video-2",
    title: "Comedy Park Sketch",
    author: "@funny_people",
    description: "A short comedy scene with no product or buying intent.",
    likesText: "Likes 320",
    commentsText: "Comments 4",
    sharesText: "Shares 12",
    shopHref: "",
    comments: ["Comment: Haha this is funny"],
  },
  {
    id: "video-3",
    title: "Ocean Sunset Walk",
    author: "@travel_daily",
    description: "Scenery and relaxation only, no product being sold.",
    likesText: "Likes 980",
    commentsText: "Comments 2",
    sharesText: "Shares 18",
    shopHref: "",
    comments: ["Comment: Beautiful view"],
  },
  {
    id: "video-4",
    title: "Kitchen Organizer Unboxing #home",
    author: "@home_hacks",
    description: "Unboxing the organizer, showing storage problems solved and the shop entry.",
    likesText: "点赞 3万",
    commentsText: "评论 26",
    sharesText: "分享 250",
    shopHref: "/shop/kitchen-organizer",
    comments: ["Comment: 哪里买？", "Comment: 多少钱一个？", "Comment: 想看链接"],
  },
  {
    id: "video-5",
    title: "Daily Breakfast Vlog",
    author: "@daylog",
    description: "A personal vlog without product recommendation or shopping intent.",
    likesText: "Likes 410",
    commentsText: "Comments 3",
    sharesText: "Shares 7",
    shopHref: "",
    comments: ["Comment: Good morning"],
  },
  {
    id: "video-6",
    title: "Desk Lamp Comparison Product Demo",
    author: "@desk_setup",
    description: "A product comparison with brightness tests and buying advice.",
    likesText: "Likes 2.4K",
    commentsText: "Comments 14",
    sharesText: "Shares 90",
    shopHref: "/shop/desk-lamp",
    comments: ["Comment: Which lamp should I buy?", "Comment: Please share the purchase link"],
  },
];

const FIXTURE_HTML = `
<html>
  <head><title>Product Video DOM Fixture</title></head>
  <body>
    <main>
      <h1 id="video-title"></h1>
      <p id="video-author"></p>
      <p id="video-description"></p>
      <p id="video-likes"></p>
      <p id="video-comments-text"></p>
      <p id="video-shares"></p>
      <a id="shop-link" href="#">Shop product</a>
      <button id="comments-button" aria-label="Open comments">Comments</button>
      <button id="next-button" aria-label="Next video">Next video</button>
      <section id="comments-panel" hidden></section>
    </main>
    <script>
      const videos = ${JSON.stringify(fixtureVideos)};
      let index = 0;
      const titleNode = document.getElementById("video-title");
      const authorNode = document.getElementById("video-author");
      const descriptionNode = document.getElementById("video-description");
      const likesNode = document.getElementById("video-likes");
      const commentsNode = document.getElementById("video-comments-text");
      const sharesNode = document.getElementById("video-shares");
      const shopNode = document.getElementById("shop-link");
      const commentsPanel = document.getElementById("comments-panel");
      const commentsButton = document.getElementById("comments-button");
      const nextButton = document.getElementById("next-button");
      function renderComments(video) {
        commentsPanel.innerHTML = video.comments.map((comment) => '<p>' + comment + '</p>').join('');
      }
      function render() {
        const video = videos[index];
        document.title = video.title;
        titleNode.textContent = video.title;
        authorNode.textContent = 'Author ' + video.author;
        descriptionNode.textContent = 'Description ' + video.description;
        likesNode.textContent = video.likesText;
        commentsNode.textContent = video.commentsText;
        sharesNode.textContent = video.sharesText;
        shopNode.hidden = !video.shopHref;
        shopNode.href = video.shopHref || '#';
        shopNode.textContent = video.shopHref ? 'Shop product' : 'No shop link';
        commentsPanel.hidden = true;
        renderComments(video);
        location.hash = video.id;
      }
      commentsButton.addEventListener('click', () => {
        commentsPanel.hidden = false;
      });
      nextButton.addEventListener('click', () => {
        index = Math.min(index + 1, videos.length - 1);
        render();
      });
      render();
    </script>
  </body>
</html>
`;

export const writeProductVideoDomFixture = (htmlPath: string): void => {
  writeFileSync(htmlPath, FIXTURE_HTML);
};