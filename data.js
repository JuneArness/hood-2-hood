/* ==========================================================================
   Hood 2 Hood Rydas | data.js : the settings you can edit.
   Never put a password, secret key or "service_role" key in this file.
   The Supabase "publishable" (anon) key below is public by design.
   ========================================================================== */
window.H2H = {
  /* ------------------------------------------------------------------------
     1. CLUB
     ------------------------------------------------------------------------ */
  club: "Hood 2 Hood Rydas",
  email: "H2HRydas@gmail.com",
  // Leave blank until confirmed. Shown on Contact and in the footer when set.
  phone: "",
  city: "",            // e.g. "Jackson, MI"
  // Shown on Home > The Club until members are added in Admin > Members.
  leaders: [
    { name: "Stephen Parks Jr.", role: "Founder & President" },
    { name: "Gina McCoy", role: "Co-Founder" },
    { name: "Jonnathan Brown", role: "Vice President" }
  ],

  /* ------------------------------------------------------------------------
     2. DATABASE CONNECTION (Supabase > Project Settings > API)
     Paste the Project URL and the "publishable" / anon public key.
     ------------------------------------------------------------------------ */
  supabaseUrl: "",
  supabaseKey: "",

  /* ------------------------------------------------------------------------
     3. ONLINE GIVING (optional)
     Paste a payment link (Zeffy, PayPal, Square, Stripe or Cash App) to show
     a "Give online" button on the Get Involved page.
     ------------------------------------------------------------------------ */
  donateUrl: "",
  donateButton: "Give online",
  donateNote: "Hood 2 Hood Rydas is a car club, not yet a registered 501(c)(3) nonprofit, so gifts are not tax-deductible.",

  /* ------------------------------------------------------------------------
     3b. THE ANTHEM: "Alien Skin" by June Arness (the scrolling bar at the top)
     Upload the song to the repository as  alien-skin.mp3  and it plays once
     when someone opens the site (browsers may wait for their first tap).
     Until the file is there, the play button opens the song on YouTube.
     ------------------------------------------------------------------------ */
  anthem: {
    file: "alien-skin.mp3",
    title: "Alien Skin",
    artist: "June Arness",
    album: "The Art-of-Fact (Un Earthed)",
    cover: "alien-skin-cover.jpg",
    autoplayOnce: true,
    links: [
      { label: "Spotify", url: "https://open.spotify.com/track/1vo69EMsvWoANby4M0C7Wb" },
      { label: "Apple Music", url: "https://music.apple.com/us/song/alien-skin/1725046124" },
      { label: "iHeart", url: "https://www.iheart.com/artist/june-arness-42138078/songs/alien-skin-330534713/" },
      { label: "Pandora", url: "https://www.pandora.com/artist/june-arness/the-art-of-fact-un-earthed/alien-skin/TRbhrdpvg4bgbXV" },
      { label: "YouTube", url: "https://youtu.be/XSehO1X0FVE" }
    ]
  },

  /* ------------------------------------------------------------------------
     4. CARS BUILT INTO THE SITE
     These show in the Showroom even before the database is connected.
     In Admin > Showroom you can "Move into the database" so staff can edit it.
     A built-in car hides itself once the database has a car with the same name.
     ------------------------------------------------------------------------ */
  builtInCars: [
    {
      name: "MelTee",
      year: 1990, make: "Lincoln", model: "Town Car",
      wrap_name: "Alien Skin",
      owner_name: "Stephen Parks Jr.",
      tagline: "A 1990 Lincoln Town Car wrapped in Alien Skin.",
      story: "MelTee is the founder’s lowrider: a 1990 Lincoln Town Car on wire wheels and whitewalls, with a hydraulic setup in the trunk and a holographic wrap called Alien Skin that turns every streetlight into a rainbow.",
      specs: [
        { label: "Year", value: "1990" },
        { label: "Make", value: "Lincoln" },
        { label: "Model", value: "Town Car" },
        { label: "Wrap", value: "Alien Skin (holographic)" },
        { label: "Wheels", value: "Wire wheels, whitewall tires" },
        { label: "Suspension", value: "Hydraulics" }
      ],
      anthem_url: "https://youtu.be/XSehO1X0FVE",
      clip: { src: "meltee-clip.mp4", poster: "meltee-clip-poster.jpg" },
      accent: "#39f3ff", mode: "ring", speed: 5,
      photos: [
        { src: "meltee-01.jpg", caption: "Alien Skin under the lot lights" },
        { src: "meltee-02.jpg", caption: "Holographic from every angle" },
        { src: "meltee-03.jpg", caption: "Trunk open, setup showing" },
        { src: "meltee-04.jpg", caption: "Low and slow at sunset" },
        { src: "meltee-05.jpg", caption: "On the show floor" },
        { src: "meltee-06.jpg", caption: "Golden hour at the car show" },
        { src: "meltee-07.jpg", caption: "Pumps and lines" },
        { src: "meltee-08.jpg", caption: "Color that moves" },
        { src: "meltee-09.jpg", caption: "Front three-quarter" },
        { src: "meltee-10.jpg", caption: "The long side" },
        { src: "meltee-11.jpg", caption: "Head-on grille" },
        { src: "meltee-12.jpg", caption: "Rear three-quarter" }
      ]
    }
  ],

  /* ------------------------------------------------------------------------
     5. PAST EVENTS BUILT INTO THE SITE (optional)
     Standard: the first photo is the event flyer. Use date: "YYYY-MM-DD"
     or when: "Summer 2026". New events should be added in Admin instead.
     ------------------------------------------------------------------------ */
  pastEvents: []
};
