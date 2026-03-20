the current merging quality is very bad. the merge agent will often just ignore the work of a branch completely. eg when the merge agent merged set 3 then 4, it left out stuff in set 3 

● Now I have the full picture. Let me present the findings.

  --- Bug Investigation Results ---
  Root Cause: The markdown-ext merge (954f634) clobbered the file-io implementation.
              Commit 8d4c117 partially restored message types but only added stub handlers
              that set status text without actually opening files.

  File(s):
    - crates/trust-app/src/app.rs (stubs instead of real implementation)
    - crates/trust-app/src/messages.rs (missing FileMessage/SidebarMessage variants)

  Analysis: The file-io branch was properly merged at 947a35f, but the subsequent
            markdown-ext merge resolved conflicts by keeping markdown-ext's stubs
            over file-io's working handlers. The follow-up commit (8d4c117) added
            message types back but only with placeholder "status text" handlers.

These are the outputs from the bugfix agent that detail an example of the issue.
We need to make the merge agent SET aware and it should NEVER remove features already implemented.
