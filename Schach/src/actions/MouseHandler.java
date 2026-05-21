package actions;

import application.Client;
import application.Main;
import application.Server;
import game.*;
import gui.IL;

import java.awt.*;
import java.awt.event.MouseEvent;
import java.awt.event.MouseListener;

public class MouseHandler implements MouseListener {
    @Override
    public void mouseClicked(MouseEvent e) {


    }

    @Override
    public void mousePressed(MouseEvent e) {
        if(!Board.gameOver){
            if (Mouse.insideField) {
                if(Main.multRunning){
                    if(Main.isServer){
                        if(Board.serverWhite && Board.turnWhite){
                            Point p = Mouse.ctp(new Point(e.getX(), e.getY()));
                            Board.move(p);
                        }else if(!Board.serverWhite && !Board.turnWhite){
                            Point p = Mouse.ctp(new Point(e.getX(), e.getY()));
                            Board.move(p);
                        }
                    }else{
                        if(Board.serverWhite && !Board.turnWhite){
                            Point p = Mouse.ctp(new Point(e.getX(), e.getY()));
                            Board.move(p);
                        }else if(!Board.serverWhite && Board.turnWhite){
                            Point p = Mouse.ctp(new Point(e.getX(), e.getY()));
                            Board.move(p);
                        }
                    }
                }else{
                    Point p = Mouse.ctp(new Point(e.getX(), e.getY()));
                    Board.move(p);
                }

            }
        }

    }

    @Override
    public void mouseReleased(MouseEvent e) {

    }

    @Override
    public void mouseEntered(MouseEvent e) {

    }

    @Override
    public void mouseExited(MouseEvent e) {

    }
}
