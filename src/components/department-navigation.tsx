"use client";

import { useState, type ReactNode } from "react";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

export function DepartmentNavigation({ name, children }: { name: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="hidden lg:block">{children}</div>
      <div className="lg:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" className="h-11 w-full justify-start rounded-xl">
              <Menu aria-hidden="true" />
              <span className="truncate">Navegar em {name}</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" showCloseButton={false} className="w-[min(90vw,24rem)]! gap-0 overflow-y-auto overscroll-contain">
            <SheetHeader className="border-b p-5 pr-14">
              <SheetTitle className="break-words">{name}</SheetTitle>
              <SheetDescription>Explore as documentações do departamento.</SheetDescription>
            </SheetHeader>
            <SheetClose asChild>
              <Button variant="ghost" size="icon" className="absolute right-3 top-3" aria-label="Fechar navegação"><X aria-hidden="true" /></Button>
            </SheetClose>
            <div className="p-4" onClick={(event) => {
              if (!event.defaultPrevented && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey && event.target instanceof Element && event.target.closest("a[href]")) setOpen(false);
            }}>{children}</div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
