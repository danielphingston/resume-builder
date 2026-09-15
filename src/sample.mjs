export const legacyInitial = {
  name: 'Jordan Davis', role: 'Senior Product Designer', email: 'jordan.davis@email.com', phone: '+1 (415) 555-0128', location: 'San Francisco, CA', website: 'jordandavis.design',
  design: { template: 'editorial', accent: '#205c52', font: 'sans', size: 10, margin: 42, spacing: 20, lineHeight: 1.55, columns: 2, ratio: 65, background: 'clean', icons: 'minimal', paper: 'a4' },
  sections: [
    {id:'summary', title:'Profile', type:'text', column:'main', text:'Thoughtful product designer turning complex problems into simple, meaningful experiences. 7+ years partnering with ambitious teams to build products that people love to use.'},
    {id:'experience', title:'Experience', type:'entries', column:'main', entries:[
      {title:'Senior Product Designer', subtitle:'Notion', date:'2022 — Present', location:'San Francisco, CA', bullets:['Led the end-to-end redesign of workspace onboarding, increasing activation by 28%.','Partnered with engineering and research to ship 12+ features used by over 2 million people.','Built a scalable design system that reduced design-to-development time by 35%.']},
      {title:'Product Designer', subtitle:'Intercom', date:'2019 — 2022', location:'San Francisco, CA', bullets:['Designed intuitive customer support workflows for 25,000+ businesses.','Improved help center discovery, reducing support tickets by 18%.','Collaborated with a team of 6 designers to evolve the core product experience.']},
      {title:'Visual Designer', subtitle:'Studio North', date:'2017 — 2019', location:'Brooklyn, NY', bullets:['Created brand identities and digital experiences for 15+ early-stage startups.','Translated brand strategy into cohesive, accessible visual systems.']}
    ]},
    {id:'education',title:'Education',type:'entries',column:'side',entries:[{title:'BFA, Communication Design',subtitle:'California College of the Arts',date:'2013 — 2017',location:'',bullets:[]}]},
    {id:'skills',title:'Expertise',type:'list',column:'side',items:['Product strategy','Interaction design','Design systems','User research','Prototyping','Accessibility','Visual design']},
    {id:'tools',title:'Tools',type:'list',column:'side',items:['Figma','FigJam','Framer','Webflow','Adobe Creative Suite']},
    {id:'extra',title:'Beyond the screen',type:'text',column:'side',text:'Weekend ceramicist. Amateur trail runner. Always collecting good books and better questions.'}
  ]
};
