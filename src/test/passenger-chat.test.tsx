import { act, render, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AssistantChat } from '@/components/flightfix/passenger';
import { sendChat, type PassengerData } from '@/lib/flightfix';
vi.mock('@/lib/flightfix', async importOriginal => ({ ...await importOriginal<typeof import('@/lib/flightfix')>(),sendChat:vi.fn() }));
vi.mock('@/components/ai-elements/conversation',()=>({Conversation:({children}:{children:React.ReactNode})=><div>{children}</div>,ConversationContent:({children}:{children:React.ReactNode})=><div>{children}</div>}));
vi.mock('@/components/ai-elements/message',()=>({Message:({children}:{children:React.ReactNode})=><div>{children}</div>,MessageContent:({children}:{children:React.ReactNode})=><div>{children}</div>,MessageResponse:({children}:{children:React.ReactNode})=><div>{children}</div>}));
vi.mock('@/components/ai-elements/shimmer',()=>({Shimmer:()=>null}));
vi.mock('@/components/ai-elements/prompt-input',()=>({PromptInput:({children}:{children:React.ReactNode})=><div>{children}</div>,PromptInputTextarea:()=>null,PromptInputFooter:({children}:{children:React.ReactNode})=><div>{children}</div>,PromptInputSubmit:()=>null}));
const data={ok:true,data_version:'v1',passenger:{first_name:'Test',last_name:'Passenger',booking_ref:'test'},flight:{status:'cancelled'},options:[],outcome:null} as PassengerData;
describe('Chat execution lifecycle',()=>{
 beforeEach(()=>{sessionStorage.clear();vi.clearAllMocks();vi.mocked(sendChat).mockResolvedValue('Welcome. What would you like?');});
 it('starts hidden Hi once and does not refresh for an informational reply',async()=>{
  const client=new QueryClient();const invalidate=vi.spyOn(client,'invalidateQueries');
  const view=render(<QueryClientProvider client={client}><AssistantChat token="test" d={data}/></QueryClientProvider>);
  await waitFor(()=>expect(sendChat).toHaveBeenCalledTimes(1));
  await act(async()=>{});
  view.rerender(<QueryClientProvider client={client}><AssistantChat token="test" d={{...data}}/></QueryClientProvider>);
  expect(sendChat).toHaveBeenCalledWith(expect.any(String),'Hi','test');expect(sendChat).toHaveBeenCalledTimes(1);expect(invalidate).not.toHaveBeenCalled();
  view.unmount();
 });
 it('creates a new session and hidden Hi when data_version changes',async()=>{
  const client=new QueryClient();const view=render(<QueryClientProvider client={client}><AssistantChat token="test" d={data}/></QueryClientProvider>);
  await waitFor(()=>expect(sendChat).toHaveBeenCalledTimes(1));await act(async()=>{});
  const first=vi.mocked(sendChat).mock.calls[0]?.[0];
  view.rerender(<QueryClientProvider client={client}><AssistantChat token="test" d={{...data,data_version:'v2'}}/></QueryClientProvider>);
  await waitFor(()=>expect(sendChat).toHaveBeenCalledTimes(2));expect(vi.mocked(sendChat).mock.calls[1]?.[0]).not.toBe(first);expect(sessionStorage.getItem('ff-version-test')).toBe('v2');view.unmount();
 });
 it('refreshes passenger only on confirmed reply outside preview',async()=>{
  vi.mocked(sendChat).mockResolvedValue('Confirmed');const client=new QueryClient();const invalidate=vi.spyOn(client,'invalidateQueries');
  const view=render(<QueryClientProvider client={client}><AssistantChat token="test" d={data}/></QueryClientProvider>);
  await waitFor(()=>expect(invalidate).toHaveBeenCalledWith({queryKey:['passenger','test']}));expect(invalidate).toHaveBeenCalledTimes(1);view.unmount();
 });
 it('refreshes ops as well behind preview after a qualifying reply',async()=>{
  vi.mocked(sendChat).mockResolvedValue('I passed your case to the airline team');const client=new QueryClient();const invalidate=vi.spyOn(client,'invalidateQueries');
  const view=render(<QueryClientProvider client={client}><AssistantChat token="test" d={data} refreshOps/></QueryClientProvider>);
  await waitFor(()=>expect(invalidate).toHaveBeenCalledTimes(2));expect(invalidate).toHaveBeenCalledWith({queryKey:['ops']});view.unmount();
 });
});
