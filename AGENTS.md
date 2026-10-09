<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep original demo CSS in a separate unchanged global stylesheet and put integration-only scrolling rules in the main stylesheet, so reference fidelity stays auditable.
- Use shared React FlightFix content and chat with explicit preview versus standalone presentation; only previews have phone frames, so live wiring remains identical without framing the real page.
- Keep request freshness and chat refresh decisions in the shared recovery policy; version saved chat sessions with API data_version, so paid n8n requests are minimized without stale reset conversations.
- Compose the chat transcript, response rendering, loading and composer with AI Elements styled by FlightFix classes, so standard chat behavior retains reference fidelity.
- Keep simulated message delivery and display preferences browser-local; flight, passenger and recovery records are authoritative from n8n.
- Keep staff routing limited to the class-demo screens and expand the Operations flight table in place, so removed pages cannot leave dead navigation.
